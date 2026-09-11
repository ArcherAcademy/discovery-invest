-- ============================================================
-- Archer Invest Demo — Workflow Engine tables
-- Prefix: demo_invest_  (shared Supabase, no conflicts)
-- Run ONCE via Supabase SQL Editor
-- ============================================================

-- ─── demo_invest_trigger_sent ──────────────────────────────
-- Hard database-level dedup lock: one row per (user_id, workflow_naam).
-- The UNIQUE constraint makes it physically impossible to send twice,
-- even if the evaluator runs concurrently.
CREATE TABLE IF NOT EXISTS demo_invest_trigger_sent (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  user_id       uuid        NOT NULL REFERENCES demo_invest_users(id) ON DELETE CASCADE,
  workflow_naam text        NOT NULL,
  CONSTRAINT demo_invest_trigger_sent_unique UNIQUE (user_id, workflow_naam)
);

CREATE INDEX IF NOT EXISTS demo_invest_trigger_sent_user_idx ON demo_invest_trigger_sent(user_id);

ALTER TABLE demo_invest_trigger_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_invest_trigger_sent: service insert"
  ON demo_invest_trigger_sent FOR INSERT
  WITH CHECK (true);

CREATE POLICY "demo_invest_trigger_sent: service read"
  ON demo_invest_trigger_sent FOR SELECT
  USING (true);

CREATE POLICY "demo_invest_trigger_sent: admins read all"
  ON demo_invest_trigger_sent FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM demo_invest_users du
      WHERE du.id = auth.uid() AND du.role = 'admin'
    )
  );

-- ─── demo_invest_trigger_log ───────────────────────────────
-- Every workflow decision (fired / suppressed / failed) is logged here.
CREATE TABLE IF NOT EXISTS demo_invest_trigger_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  user_id          uuid        NOT NULL REFERENCES demo_invest_users(id) ON DELETE CASCADE,
  contact_email    text        NOT NULL,
  workflow_nummer  integer     NOT NULL,
  workflow_naam    text        NOT NULL,
  status           text        NOT NULL CHECK (status IN ('verstuurd', 'onderdrukt', 'gefaald', 'no_endpoint')),
  reden            text,
  payload_json     jsonb       NOT NULL DEFAULT '{}',
  response_status  text
);

CREATE INDEX IF NOT EXISTS demo_invest_trigger_log_user_id_idx   ON demo_invest_trigger_log(user_id);
CREATE INDEX IF NOT EXISTS demo_invest_trigger_log_workflow_idx  ON demo_invest_trigger_log(workflow_nummer);
CREATE INDEX IF NOT EXISTS demo_invest_trigger_log_created_idx   ON demo_invest_trigger_log(created_at DESC);

ALTER TABLE demo_invest_trigger_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_invest_trigger_log: users read own"
  ON demo_invest_trigger_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "demo_invest_trigger_log: service insert"
  ON demo_invest_trigger_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "demo_invest_trigger_log: admins read all"
  ON demo_invest_trigger_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM demo_invest_users du
      WHERE du.id = auth.uid() AND du.role = 'admin'
    )
  );

-- ─── demo_invest_webhook_config ────────────────────────────
-- One row per workflow — stores the outbound webhook URL and on/off toggle.
CREATE TABLE IF NOT EXISTS demo_invest_webhook_config (
  trigger_naam  text    PRIMARY KEY,
  label         text    NOT NULL DEFAULT '',
  webhook_url   text    NOT NULL DEFAULT '',
  actief        boolean NOT NULL DEFAULT true
);

ALTER TABLE demo_invest_webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_invest_webhook_config: admins manage"
  ON demo_invest_webhook_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM demo_invest_users du
      WHERE du.id = auth.uid() AND du.role = 'admin'
    )
  );

CREATE POLICY "demo_invest_webhook_config: service read"
  ON demo_invest_webhook_config FOR SELECT
  USING (true);

-- Seed: 15 workflows
INSERT INTO demo_invest_webhook_config (trigger_naam, label, webhook_url, actief) VALUES
  ('welkom',               'W1 · Welkom na activatie',               '', true),
  ('activatie_2u',         'W2 · Niet geactiveerd na 2 uur',         '', true),
  ('activatie_24u',        'W3 · Niet geactiveerd na 24 uur',        '', true),
  ('activatie_72u',        'W4 · Niet geactiveerd na 72 uur',        '', true),
  ('video_1_herinnering',  'W5 · Herinnering video 1',               '', true),
  ('video_2_herinnering',  'W6 · Herinnering video 2',               '', true),
  ('video_3_herinnering',  'W7 · Herinnering video 3',               '', true),
  ('video_4_herinnering',  'W8 · Herinnering video 4',               '', true),
  ('video_5_herinnering',  'W9 · Herinnering video 5',               '', true),
  ('video_6_herinnering',  'W10 · Herinnering video 6',              '', true),
  ('alles_gezien_c1',      'W11 · Alle 6 kernvideo''s bekeken',      '', true),
  ('dag4_inactief',        'W12 · Dag 4 zonder actie na voltooiing', '', true),
  ('workshop_1w_voor',     'W13 · 1 week voor workshop',             '', true),
  ('workshop_bevestiging', 'W14 · Workshop boeking bevestigd',       '', true),
  ('trial_verlopen',       'W15 · Trial verlopen zonder boeking',    '', true)
ON CONFLICT (trigger_naam) DO NOTHING;

-- ─── demo_invest_config ────────────────────────────────────
-- Key/value store for all timing thresholds (in minutes).
CREATE TABLE IF NOT EXISTS demo_invest_config (
  sleutel  text PRIMARY KEY,
  waarde   text NOT NULL
);

ALTER TABLE demo_invest_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_invest_config: admins manage"
  ON demo_invest_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM demo_invest_users du
      WHERE du.id = auth.uid() AND du.role = 'admin'
    )
  );

CREATE POLICY "demo_invest_config: service read"
  ON demo_invest_config FOR SELECT
  USING (true);

-- Seed: timing thresholds
INSERT INTO demo_invest_config (sleutel, waarde) VALUES
  ('activatie_2u_minuten',      '120'),
  ('activatie_24u_minuten',     '1440'),
  ('activatie_72u_minuten',     '4320'),
  ('inactiviteit_minuten',      '1440'),
  ('dag4_minuten',              '5760'),
  ('workshop_nudge_w1_minuten', '10080'),
  ('trial_minuten',             '10080'),
  ('video_nudge_cap',           '5')
ON CONFLICT (sleutel) DO NOTHING;
