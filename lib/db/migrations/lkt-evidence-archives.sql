BEGIN;
SELECT pg_advisory_xact_lock(6202612);
CREATE TABLE IF NOT EXISTS lkt_evidence_archives (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  reference_id text NOT NULL,
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  source_url text NOT NULL,
  locator text NOT NULL,
  reviewed_at date NOT NULL,
  captured_at timestamptz NOT NULL,
  checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  object_path text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('text/plain', 'application/pdf', 'image/png', 'image/jpeg')),
  byte_length integer NOT NULL CHECK (byte_length > 0 AND byte_length <= 20000000),
  description text NOT NULL
);
CREATE OR REPLACE FUNCTION lkt_reject_archive_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidence archives are append-only';
END;
$$;
DROP TRIGGER IF EXISTS lkt_archive_append_only ON lkt_evidence_archives;
CREATE TRIGGER lkt_archive_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON lkt_evidence_archives
  FOR EACH STATEMENT EXECUTE FUNCTION lkt_reject_archive_rewrite();
COMMIT;
