// One-off: apply db/schema.sql to the Neon DATABASE_URL from .env.local.
// Run with: npx tsx db/apply.ts
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, "..", ".env.local") });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

async function main() {
  const pool = new Pool({ connectionString: url! });
  const schema = readFileSync(join(here, "schema.sql"), "utf8");
  console.log("applying schema…");
  await pool.query(schema);
  await pool.end();
  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
