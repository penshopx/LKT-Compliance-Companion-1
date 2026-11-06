// Nullable and additive: historical answers intentionally remain without snapshots.
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("ALTER TABLE lkt_messages ADD COLUMN IF NOT EXISTS reference_snapshot jsonb");
  process.stdout.write("LKT consultation snapshot column ready; existing history unchanged.\n");
} finally {
  await pool.end();
}
