BEGIN;
SELECT pg_advisory_xact_lock(6202618);
CREATE TABLE IF NOT EXISTS lkt_operators (
  user_id text PRIMARY KEY,
  display_name text NOT NULL CHECK(length(trim(display_name)) > 0)
);
CREATE TABLE IF NOT EXISTS lkt_editorial_access_events (
  id serial PRIMARY KEY,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  source text NOT NULL CHECK(source IN ('panel', 'cli')),
  role text NOT NULL CHECK(role IN ('editor', 'operator')),
  action text NOT NULL CHECK(action IN ('grant', 'revoke')),
  target_user_id text NOT NULL,
  target_name text NOT NULL,
  reason text NOT NULL CHECK(length(trim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION lkt_reject_access_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Editorial access history is append-only';
END;
$$;
DROP TRIGGER IF EXISTS lkt_editorial_access_append_only ON lkt_editorial_access_events;
CREATE TRIGGER lkt_editorial_access_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON lkt_editorial_access_events
  FOR EACH STATEMENT EXECUTE FUNCTION lkt_reject_access_rewrite();
COMMIT;
