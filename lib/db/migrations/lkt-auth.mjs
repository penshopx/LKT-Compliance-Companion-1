// Additive, repeatable migration. Never truncate or claim legacy browser rows.
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(6202602)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS lkt_organizations (
      id text PRIMARY KEY, name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lkt_memberships (
      organization_id text NOT NULL REFERENCES lkt_organizations(id) ON DELETE CASCADE,
      user_id text NOT NULL, role text NOT NULL,
      PRIMARY KEY (organization_id, user_id)
    );
    ALTER TABLE lkt_workspaces ADD COLUMN IF NOT EXISTS organization_id text;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lkt_workspaces_organization_id_unique') THEN
        ALTER TABLE lkt_workspaces ADD CONSTRAINT lkt_workspaces_organization_id_unique UNIQUE (organization_id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lkt_workspaces_organization_id_lkt_organizations_id_fk') THEN
        ALTER TABLE lkt_workspaces ADD CONSTRAINT lkt_workspaces_organization_id_lkt_organizations_id_fk
          FOREIGN KEY (organization_id) REFERENCES lkt_organizations(id) ON DELETE CASCADE;
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS lkt_ai_usage (
      key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lkt_ai_leases (
      organization_id text PRIMARY KEY REFERENCES lkt_organizations(id) ON DELETE CASCADE,
      request_id text NOT NULL, expires_at timestamptz NOT NULL
    );
  `);
  await client.query("COMMIT");
  process.stdout.write("LKT account migration applied without claiming or deleting legacy data.\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
