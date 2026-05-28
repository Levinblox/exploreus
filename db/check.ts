import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
config({ path: "/Users/levinhansen/Exploreus/.env.local" });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const u = await pool.query("SELECT device_id, name, map_style, created_at FROM users ORDER BY created_at DESC LIMIT 5");
  console.log("users:", u.rows);
  const h = await pool.query("SELECT count(*) FROM hikes");
  console.log("hikes count:", h.rows);
  const t = await pool.query("SELECT count(*) FROM user_trails");
  console.log("user_trails count:", t.rows);
  await pool.end();
}
main();
