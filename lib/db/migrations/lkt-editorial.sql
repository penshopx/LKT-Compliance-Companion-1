BEGIN;
SELECT pg_advisory_xact_lock(6202608);
CREATE TABLE IF NOT EXISTS lkt_editors (
  user_id text PRIMARY KEY,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0)
);
CREATE TABLE IF NOT EXISTS lkt_editorial_events (
  id serial PRIMARY KEY,
  reference_id text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lkt_editorial_events_reference_idx ON lkt_editorial_events(reference_id, id);
CREATE OR REPLACE FUNCTION lkt_reject_editorial_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Editorial history is append-only';
END;
$$;
DROP TRIGGER IF EXISTS lkt_editorial_append_only ON lkt_editorial_events;
CREATE TRIGGER lkt_editorial_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON lkt_editorial_events
  FOR EACH STATEMENT EXECUTE FUNCTION lkt_reject_editorial_rewrite();
COMMIT;
