// Loads .env.local before any other module runs. Must be the very first
// import in any entrypoint that reads process.env — ESM hoists imports above
// any code, so a `config()` call later in the file would run too late.
import { config } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, "..", ".env.local") });
