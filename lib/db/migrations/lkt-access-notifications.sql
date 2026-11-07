CREATE TABLE IF NOT EXISTS lkt_access_notifications (
  organization_id text PRIMARY KEY REFERENCES lkt_organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0,
  authorized_by text NOT NULL,
  recipient text NOT NULL,
  recipient_label text NOT NULL,
  slack_channel_id text NOT NULL,
  slack_team_id text NOT NULL,
  connection_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS lkt_access_deliveries (
  id text PRIMARY KEY REFERENCES lkt_access_audit(id) ON DELETE CASCADE,
  organization_id text NOT NULL REFERENCES lkt_organizations(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sending','delivered','failed','uncertain','cancelled')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lkt_access_delivery_pending ON lkt_access_deliveries (organization_id) WHERE status IN ('pending','sending');
