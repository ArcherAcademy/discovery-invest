-- ── demo_invest_account_webhook_log ─────────────────────────────────────────
-- Logt elk binnenkomend verzoek op /api/account-aanmaken (en alias).
-- Zowel succesvolle als gefaalde verzoeken worden opgeslagen, inclusief
-- verzoeken met een ongeldig webhook_secret.

CREATE TABLE IF NOT EXISTS demo_invest_account_webhook_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL    DEFAULT now(),
  email          text,
  payload_json   jsonb       NOT NULL    DEFAULT '{}',
  outcome        text        NOT NULL    CHECK (outcome IN ('created', 'reused', 'error')),
  reden          text,
  activatielink  text,
  http_status    integer     NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_invest_account_webhook_log_created_at
  ON demo_invest_account_webhook_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_invest_account_webhook_log_email
  ON demo_invest_account_webhook_log (email);

-- RLS: alleen admins mogen lezen
ALTER TABLE demo_invest_account_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins kunnen account_webhook_log lezen"
  ON demo_invest_account_webhook_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM demo_invest_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- De service-role (webhook endpoint) schrijft via admin client en omzeilt RLS.
