import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const TOKEN_TTL_DAYS = 60;

type AuthBody = {
  username?: string;
  password?: string;
  age?: number;
  activities?: string[];
  deviceId?: string; // for one-time data migration
};

type UserRow = {
  id: string;
  username: string | null;
  age: number | null;
  activities: string[];
  name: string | null;
  map_style: string;
};

export const auth = new Hono();

function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

function validUsername(u: string): boolean {
  return /^[a-z0-9_]{3,24}$/i.test(u);
}

const JWT_ALG = "HS256" as const;

async function issueToken(userId: string): Promise<string> {
  return sign(
    {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_DAYS * 24 * 3600,
    },
    JWT_SECRET,
    JWT_ALG
  );
}

auth.post("/signup", async (c) => {
  const body = (await c.req.json()) as AuthBody;
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!validUsername(username)) {
    return c.json({ error: "Username must be 3–24 letters, digits, or _" }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }

  // Reject if username taken (case-insensitive).
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(username) = $1`,
    [normalizeUsername(username)]
  );
  if (existing.rows.length > 0) {
    return c.json({ error: "Username is taken" }, 409);
  }

  const hash = await bcrypt.hash(password, 10);
  const activities = Array.isArray(body.activities) ? body.activities : [];
  const age = typeof body.age === "number" && body.age > 0 ? body.age : null;

  // If a device id is supplied AND there's an existing anonymous row for it,
  // upgrade that row in place so the user keeps their existing hikes/trails.
  let userId: string | null = null;
  if (body.deviceId) {
    const found = await pool.query<{ id: string; username: string | null }>(
      `SELECT id, username FROM users WHERE device_id = $1`,
      [body.deviceId]
    );
    if (found.rows.length > 0 && !found.rows[0].username) {
      // Anonymous row exists and hasn't been claimed — upgrade it.
      const u = found.rows[0];
      await pool.query(
        `UPDATE users SET username = $1, password_hash = $2, age = $3,
                          activities = $4
           WHERE id = $5`,
        [username, hash, age, activities, u.id]
      );
      userId = u.id;
    }
  }

  if (!userId) {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO users (username, password_hash, age, activities, device_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [username, hash, age, activities, body.deviceId ?? null]
    );
    userId = ins.rows[0].id;
  }

  const token = await issueToken(userId);
  return c.json({ token, userId });
});

auth.post("/login", async (c) => {
  const body = (await c.req.json()) as AuthBody;
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  const { rows } = await pool.query<{ id: string; password_hash: string | null }>(
    `SELECT id, password_hash FROM users WHERE LOWER(username) = $1`,
    [normalizeUsername(username)]
  );
  if (rows.length === 0 || !rows[0].password_hash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return c.json({ error: "Invalid credentials" }, 401);

  const token = await issueToken(rows[0].id);
  return c.json({ token, userId: rows[0].id });
});

// JWT middleware for all /api/* endpoints (except /api/auth/*).
export async function requireUser(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (!bearer) return null;
  try {
    const payload = (await verify(bearer, JWT_SECRET, JWT_ALG)) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// /api/auth/me — current user profile (called by the client to verify a token).
auth.get("/me", async (c) => {
  const userId = await requireUser(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const { rows } = await pool.query<UserRow>(
    `SELECT id, username, age, activities, name, map_style FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  const r = rows[0];
  return c.json({
    id: r.id,
    username: r.username,
    age: r.age,
    activities: r.activities ?? [],
    name: r.name ?? r.username,
    mapStyle: r.map_style,
  });
});
