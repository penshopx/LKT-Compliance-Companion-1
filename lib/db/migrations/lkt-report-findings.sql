-- Additive register. It does not modify checklist, company profile or public references.
CREATE TABLE IF NOT EXISTS lkt_report_findings (
  id text PRIMARY KEY,
  report_cycle_id text NOT NULL REFERENCES lkt_report_cycles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  problem text NOT NULL CHECK (length(btrim(problem)) BETWEEN 1 AND 5000),
  cause text NOT NULL DEFAULT '' CHECK (length(cause) <= 3000),
  evidence_needed text NOT NULL DEFAULT '' CHECK (length(evidence_needed) <= 3000),
  action_plan text NOT NULL DEFAULT '' CHECK (length(action_plan) <= 3000),
  action_result text NOT NULL DEFAULT '' CHECK (length(action_result) <= 3000),
  assignee text NOT NULL DEFAULT '' CHECK (length(assignee) <= 150),
  target_date text CHECK (target_date ~ '^\d{4}-\d{2}-\d{2}$'),
  priority text NOT NULL CHECK (priority IN ('rendah','sedang','tinggi')),
  status text NOT NULL CHECK (status IN ('terbuka','proses','menunggu_telaah','ditutup')),
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 3000),
  source_diagnosis_id text CHECK (length(source_diagnosis_id) <= 100),
  archived boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_user_id text,
  CHECK (status <> 'ditutup' OR (length(btrim(action_result)) > 0 AND length(btrim(review_note)) > 0
    AND closed_at IS NOT NULL AND closed_by_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS lkt_finding_cycle ON lkt_report_findings(report_cycle_id);
CREATE TABLE IF NOT EXISTS lkt_report_finding_events (
  id text PRIMARY KEY,
  finding_id text NOT NULL REFERENCES lkt_report_findings(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  actor_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS lkt_finding_event_revision ON lkt_report_finding_events(finding_id, revision);
