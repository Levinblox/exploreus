import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

// Neon's driver uses WebSockets. Node 22+ ships a native WebSocket; older
// Node (incl. Render's node:20-slim image) doesn't, so we wire the `ws`
// package in explicitly.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set — check .env.local");
}

export const pool = new Pool({ connectionString: url });

export async function ensureUser(deviceId: string): Promise<string> {
  // Upsert by device_id and return the canonical user UUID.
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (device_id) VALUES ($1)
     ON CONFLICT (device_id) DO UPDATE SET device_id = EXCLUDED.device_id
     RETURNING id`,
    [deviceId]
  );
  return rows[0].id;
}
