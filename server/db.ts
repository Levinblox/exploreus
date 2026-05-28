import { Pool } from "@neondatabase/serverless";

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
