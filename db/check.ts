import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
config({ path: "/Users/levinhansen/Exploreus/.env.local" });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Anonymous device users (no username) are unreachable now that login is required.
  const before = await pool.query("SELECT count(*) FROM users WHERE username IS NULL");
  const delHikes = await pool.query(
    "DELETE FROM hikes WHERE user_id IN (SELECT id FROM users WHERE username IS NULL)"
  );
  const delUsers = await pool.query("DELETE FROM users WHERE username IS NULL");
  console.log(`anonymous users before: ${before.rows[0].count}`);
  console.log(`deleted ${delHikes.rowCount} orphan hikes, ${delUsers.rowCount} anonymous users`);
  // Show remaining
  const left = await pool.query("SELECT username, (SELECT count(*) FROM hikes WHERE user_id=u.id) AS hikes FROM users u ORDER BY created_at");
  for (const r of left.rows) console.log(`  ${r.username}: ${r.hikes} hikes`);
  await pool.end();
}
main();
