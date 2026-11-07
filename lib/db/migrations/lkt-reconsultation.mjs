import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("ALTER TABLE lkt_messages ADD COLUMN IF NOT EXISTS reconsulted_from_id text");
  await pool.query("CREATE INDEX IF NOT EXISTS lkt_messages_reconsultation_idx ON lkt_messages (workspace_id, reconsulted_from_id)");
  process.stdout.write("Consultation origin ready; historical messages unchanged.\n");
} finally {
  await pool.end();
}
