CREATE TABLE IF NOT EXISTS lkt_editorial_drafts (
  id serial PRIMARY KEY,
  reference_id text NOT NULL,
  author_user_id text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  base_revision integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  snapshot jsonb NOT NULL
);
