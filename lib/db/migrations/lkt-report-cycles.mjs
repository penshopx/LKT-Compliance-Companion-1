import pg from "pg";
import { readFile } from "node:fs/promises";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(await readFile(new URL("./lkt-report-cycles.sql", import.meta.url), "utf8"));
  await client.query("COMMIT");
  process.stdout.write("Report-cycle table ready; existing company data preserved.\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
