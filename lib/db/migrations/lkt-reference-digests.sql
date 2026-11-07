CREATE TABLE IF NOT EXISTS lkt_reference_digests (
  organization_id text PRIMARY KEY REFERENCES lkt_organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0,
  recipient text NOT NULL,
  recipient_label text NOT NULL,
  slack_channel_id text NOT NULL,
  slack_team_id text NOT NULL,
  connection_id text NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  time_wib text NOT NULL CHECK (time_wib ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  authorized_by text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  pause_reason text
);
-- Additive and idempotent: existing opt-ins retain their all-library coverage.
ALTER TABLE lkt_reference_digests ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'all'
  CHECK (topic IN ('all', 'tax', 'capital_market', 'accounting_standards'));
CREATE TABLE IF NOT EXISTS lkt_digest_deliveries (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES lkt_organizations(id) ON DELETE CASCADE,
  day date NOT NULL,
  revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('sending','delivered','retry','failed','uncertain','cancelled','empty')),
  attempts integer NOT NULL DEFAULT 0,
  detail text,
  message_text text NOT NULL,
  retry_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lkt_digest_org_day UNIQUE (organization_id, day)
);
-- Email is never enabled by migration. Existing Slack subscriptions are unchanged.
ALTER TABLE lkt_reference_digests ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'slack' CHECK (channel IN ('slack','email'));
ALTER TABLE lkt_reference_digests ADD COLUMN IF NOT EXISTS sender text;
ALTER TABLE lkt_reference_digests ADD COLUMN IF NOT EXISTS sender_domain_id text;
ALTER TABLE lkt_reference_digests ADD COLUMN IF NOT EXISTS consent_nonce text;
ALTER TABLE lkt_reference_digests ADD COLUMN IF NOT EXISTS recipient_confirmed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS lkt_digest_consent_nonce ON lkt_reference_digests(consent_nonce);
ALTER TABLE lkt_digest_deliveries ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'slack' CHECK (channel IN ('slack','email'));
