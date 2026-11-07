import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("ALTER TABLE lkt_messages ADD COLUMN IF NOT EXISTS specialist text");
  process.stdout.write("Consultation focus column ready; historical attribution remains unknown.\n");
} finally {
  await pool.end();
}
