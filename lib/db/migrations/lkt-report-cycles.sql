-- Additive only. Existing profile, year-keyed checklist and consultations remain unchanged.
CREATE TABLE IF NOT EXISTS lkt_report_cycles (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES lkt_workspaces(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  kind text NOT NULL CHECK (kind IN ('nonpublik','umkm','publik','kjpp')),
  standard text NOT NULL CHECK (standard IN ('Belum ditentukan','SAK EMKM','SAK Entitas Privat','SAK Indonesia')),
  legal_form text NOT NULL CHECK (legal_form IN ('belum_ditentukan','pt_modal','pt_perorangan','selain_pt')),
  coordinator text NOT NULL DEFAULT '' CHECK (length(coordinator) <= 150),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lkt_report_workspace_year ON lkt_report_cycles(workspace_id, year);
