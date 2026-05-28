import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
config({ path: "/Users/levinhansen/Exploreus/.env.local" });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query("DELETE FROM users WHERE username LIKE 'ping_test_%'");
  console.log(`cleaned ${r.rowCount} smoke-test users`);
  await pool.end();
}
main();
