import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lkt_access_audit (
      id text PRIMARY KEY,
      organization_id text REFERENCES lkt_organizations(id) ON DELETE CASCADE,
      actor_user_id text NOT NULL,
      action text NOT NULL,
      target_user_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days',
      CONSTRAINT lkt_access_audit_shape CHECK (
        (action IN ('member_added', 'member_removed') AND organization_id IS NOT NULL AND target_user_id IS NOT NULL)
        OR (action = 'organization_deleted' AND organization_id IS NULL AND target_user_id IS NULL)
      )
    );
    CREATE INDEX IF NOT EXISTS lkt_access_audit_org_idx ON lkt_access_audit(organization_id, created_at);
    CREATE INDEX IF NOT EXISTS lkt_access_audit_actor_idx ON lkt_access_audit(actor_user_id, created_at);
    CREATE INDEX IF NOT EXISTS lkt_access_audit_expiry_idx ON lkt_access_audit(expires_at);
  `);
  process.stdout.write("LKT access audit ready; existing data unchanged.\n");
} finally {
  await pool.end();
}
