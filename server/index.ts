import "./env.js"; // MUST be first — loads .env.local before db.js etc.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ensureUser, pool } from "./db.js";
import { deleteObject, hasR2, presignPutUrl, publicUrlFor } from "./r2.js";
import { transcodeVideoInBackground } from "./transcode.js";
import { auth, requireUser } from "./auth.js";

const app = new Hono();

app.use(
  "*",
  cors({ origin: "*", allowHeaders: ["Content-Type", "X-Device-Id", "Authorization"] })
);

// Auth router — /api/auth/signup, /api/auth/login, /api/auth/me.
app.route("/api/auth", auth);

// Middleware for the rest of /api/*: prefer JWT, fall back to X-Device-Id so
// the app keeps working before signup. Anonymous device users get a row
// transparently; signup later upgrades it in place.
app.use("/api/*", async (c, next) => {
  // /api/auth/* is handled by the auth router above — never reaches here.
  const authHeader = c.req.header("Authorization");
  let userId: string | null = await requireUser(authHeader);

  if (!userId) {
    const deviceId = c.req.header("X-Device-Id");
    if (deviceId && deviceId.length >= 8) {
      userId = await ensureUser(deviceId);
    }
  }

  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId" as never, userId as never);
  await next();
});

function uid(c: any): string {
  return c.get("userId");
}

app.get("/", (c) => c.text("Exploreus API"));

// ───────── settings ─────────

app.get("/api/settings", async (c) => {
  const { rows } = await pool.query<{ name: string | null; map_style: string }>(
    `SELECT name, map_style FROM users WHERE id = $1`,
    [uid(c)]
  );
  const row = rows[0] ?? { name: null, map_style: "outdoors" };
  return c.json({ name: row.name ?? "", mapStyle: row.map_style });
});

app.patch("/api/settings", async (c) => {
  const body = (await c.req.json()) as { name?: string; mapStyle?: string };
  const sets: string[] = [];
  const args: unknown[] = [];
  if (body.name !== undefined) {
    args.push(body.name);
    sets.push(`name = $${args.length}`);
  }
  if (body.mapStyle !== undefined) {
    args.push(body.mapStyle);
    sets.push(`map_style = $${args.length}`);
  }
  if (sets.length === 0) return c.json({ ok: true });
  args.push(uid(c));
  await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${args.length}`, args);
  return c.json({ ok: true });
});

// ───────── hikes ─────────

app.get("/api/hikes", async (c) => {
  // Summaries (no full points payload — separate /:id call gets that).
  const { rows } = await pool.query(
    `SELECT id, name, started_at, ended_at, duration_ms, distance_m,
            elevation_gain_m, moving_ms, rest_ms, points
       FROM hikes WHERE user_id = $1 ORDER BY started_at DESC`,
    [uid(c)]
  );
  const summaries = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    startedAt: Number(r.started_at),
    endedAt: Number(r.ended_at),
    durationMs: Number(r.duration_ms),
    distanceM: r.distance_m,
    elevationGainM: r.elevation_gain_m,
    movingMs: r.moving_ms != null ? Number(r.moving_ms) : undefined,
    restMs: r.rest_ms != null ? Number(r.rest_ms) : undefined,
    preview: thin(r.points, 32),
  }));
  return c.json(summaries);
});

app.get("/api/hikes/full", async (c) => {
  // Full hikes (used by the all-hikes overview map).
  const { rows } = await pool.query(
    `SELECT * FROM hikes WHERE user_id = $1 ORDER BY started_at DESC`,
    [uid(c)]
  );
  return c.json(rows.map(rowToHike));
});

app.get("/api/hikes/:id", async (c) => {
  const { rows } = await pool.query(
    `SELECT * FROM hikes WHERE user_id = $1 AND id = $2`,
    [uid(c), c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "not found" }, 404);
  return c.json(rowToHike(rows[0]));
});

app.post("/api/hikes", async (c) => {
  const h = (await c.req.json()) as any;
  await pool.query(
    `INSERT INTO hikes (id, user_id, name, started_at, ended_at, duration_ms,
                        distance_m, elevation_gain_m, moving_ms, rest_ms, points)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       ended_at = EXCLUDED.ended_at,
       duration_ms = EXCLUDED.duration_ms,
       distance_m = EXCLUDED.distance_m,
       elevation_gain_m = EXCLUDED.elevation_gain_m,
       moving_ms = EXCLUDED.moving_ms,
       rest_ms = EXCLUDED.rest_ms,
       points = EXCLUDED.points`,
    [
      h.id,
      uid(c),
      h.name,
      h.startedAt,
      h.endedAt,
      h.durationMs,
      h.distanceM,
      h.elevationGainM,
      h.movingMs ?? null,
      h.restMs ?? null,
      JSON.stringify(h.points),
    ]
  );
  return c.json({ ok: true });
});

app.delete("/api/hikes/:id", async (c) => {
  await pool.query(`DELETE FROM hikes WHERE user_id = $1 AND id = $2`, [
    uid(c),
    c.req.param("id"),
  ]);
  return c.json({ ok: true });
});

// ───────── user trails ─────────

app.get("/api/user-trails", async (c) => {
  const { rows } = await pool.query(
    `SELECT * FROM user_trails WHERE user_id = $1 ORDER BY created_at DESC`,
    [uid(c)]
  );
  return c.json(rows.map(rowToTrail));
});

app.get("/api/user-trails/:id", async (c) => {
  const { rows } = await pool.query(
    `SELECT * FROM user_trails WHERE user_id = $1 AND id = $2`,
    [uid(c), c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "not found" }, 404);
  return c.json(rowToTrail(rows[0]));
});

app.post("/api/user-trails", async (c) => {
  const t = (await c.req.json()) as any;
  await pool.query(
    `INSERT INTO user_trails (id, user_id, name, ref, network, from_label, to_label,
                              distance_m, start_lat, start_lng, preview, segments, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       ref = EXCLUDED.ref,
       network = EXCLUDED.network,
       from_label = EXCLUDED.from_label,
       to_label = EXCLUDED.to_label,
       distance_m = EXCLUDED.distance_m,
       start_lat = EXCLUDED.start_lat,
       start_lng = EXCLUDED.start_lng,
       preview = EXCLUDED.preview,
       segments = EXCLUDED.segments,
       featured = EXCLUDED.featured`,
    [
      t.id,
      uid(c),
      t.name,
      t.ref ?? null,
      t.network ?? null,
      t.from ?? null,
      t.to ?? null,
      t.distanceM,
      t.start.lat,
      t.start.lng,
      JSON.stringify(t.preview),
      JSON.stringify(t.segments),
      t.featured ?? false,
    ]
  );
  return c.json({ ok: true });
});

app.delete("/api/user-trails/:id", async (c) => {
  await pool.query(`DELETE FROM user_trails WHERE user_id = $1 AND id = $2`, [
    uid(c),
    c.req.param("id"),
  ]);
  return c.json({ ok: true });
});

// ───────── media (photos + videos) ─────────

// Step 1 of an upload: client asks for a presigned PUT URL. Server picks the
// storage key so the client can't overwrite arbitrary paths.
app.post("/api/upload/presign", async (c) => {
  if (!hasR2()) return c.json({ error: "R2 not configured" }, 503);
  const body = (await c.req.json()) as {
    kind: "photo" | "video";
    contentType: string;
    ext?: string;
  };
  if (!["photo", "video"].includes(body.kind)) {
    return c.json({ error: "bad kind" }, 400);
  }
  const ext = (body.ext ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 5);
  const id = crypto.randomUUID();
  const key = `${uid(c)}/${body.kind}/${id}${ext ? "." + ext : ""}`;
  const uploadUrl = await presignPutUrl(key, body.contentType);
  return c.json({
    id,
    key,
    uploadUrl,
    publicUrl: publicUrlFor(key),
  });
});

// Step 2: client tells the server where the file landed.
app.post("/api/media", async (c) => {
  const m = (await c.req.json()) as {
    id: string;
    parentKind: "user_trail" | "hike";
    parentId: string;
    kind: "photo" | "video";
    storageKey: string;
    contentType?: string;
    caption?: string;
    sizeBytes?: number;
  };
  if (!["user_trail", "hike"].includes(m.parentKind)) {
    return c.json({ error: "bad parent_kind" }, 400);
  }
  await pool.query(
    `INSERT INTO media (id, user_id, parent_kind, parent_id, kind,
                        storage_key, content_type, caption, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      m.id,
      uid(c),
      m.parentKind,
      m.parentId,
      m.kind,
      m.storageKey,
      m.contentType ?? null,
      m.caption ?? null,
      m.sizeBytes ?? null,
    ]
  );
  // Videos: re-encode in the background so we end up with a 1080p H.264 file
  // regardless of what the device shot in. Response returns immediately; the
  // client polls /api/media to pick up the swapped storage_key.
  if (m.kind === "video" && hasR2()) {
    void transcodeVideoInBackground(m.id, m.storageKey);
  }
  return c.json({ ok: true });
});

app.get("/api/media", async (c) => {
  const parentKind = c.req.query("parentKind");
  const parentId = c.req.query("parentId");
  if (!parentKind || !parentId) {
    return c.json({ error: "parentKind and parentId required" }, 400);
  }
  const { rows } = await pool.query(
    `SELECT id, kind, storage_key, content_type, caption, size_bytes, created_at
       FROM media
      WHERE parent_kind = $1 AND parent_id = $2
      ORDER BY created_at ASC`,
    [parentKind, parentId]
  );
  return c.json(
    rows.map((r: any) => ({
      id: r.id,
      kind: r.kind,
      storageKey: r.storage_key,
      url: publicUrlFor(r.storage_key),
      contentType: r.content_type,
      caption: r.caption,
      sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null,
      createdAt: r.created_at,
    }))
  );
});

app.delete("/api/media/:id", async (c) => {
  const id = c.req.param("id");
  const { rows } = await pool.query(
    `SELECT storage_key FROM media WHERE user_id = $1 AND id = $2`,
    [uid(c), id]
  );
  if (rows.length === 0) return c.json({ error: "not found" }, 404);
  const key = rows[0].storage_key as string;
  // Best-effort R2 delete — if it fails the row is still removed; orphans can
  // be GC'd later.
  if (hasR2()) {
    try {
      await deleteObject(key);
    } catch (e) {
      console.warn("r2 delete failed", key, e);
    }
  }
  await pool.query(`DELETE FROM media WHERE user_id = $1 AND id = $2`, [uid(c), id]);
  return c.json({ ok: true });
});

// ───────── helpers ─────────

function thin<T>(arr: T[], target: number): T[] {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: T[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function rowToHike(r: any) {
  return {
    id: r.id,
    name: r.name,
    startedAt: Number(r.started_at),
    endedAt: Number(r.ended_at),
    durationMs: Number(r.duration_ms),
    distanceM: r.distance_m,
    elevationGainM: r.elevation_gain_m,
    movingMs: r.moving_ms != null ? Number(r.moving_ms) : undefined,
    restMs: r.rest_ms != null ? Number(r.rest_ms) : undefined,
    points: r.points,
  };
}

function rowToTrail(r: any) {
  return {
    id: r.id,
    name: r.name,
    ref: r.ref,
    network: r.network,
    from: r.from_label,
    to: r.to_label,
    distanceM: r.distance_m,
    start: { lat: r.start_lat, lng: r.start_lng },
    preview: r.preview,
    segments: r.segments,
    featured: r.featured,
    source: "uploaded" as const,
  };
}

const port = Number(process.env.PORT ?? 3001);
console.log(`Exploreus API on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
