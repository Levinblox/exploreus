import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
config({ path: "/Users/levinhansen/Exploreus/.env.local" });
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("DELETE FROM users WHERE username IN ('tester01','tester02')");
  console.log("cleaned test users");
  await pool.end();
}
main();
