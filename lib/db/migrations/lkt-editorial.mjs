import pg from "pg";
import { readFile } from "node:fs/promises";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(await readFile(new URL("./lkt-editorial.sql", import.meta.url), "utf8"));
  process.stdout.write("LKT editorial journal ready; no roles granted and existing findings unchanged.\n");
} finally { await pool.end(); }
