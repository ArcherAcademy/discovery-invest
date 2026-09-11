-- ── demo_invest_invites ───────────────────────────────────────────────────────
-- Stores SHA-256 hashed activation tokens for the invite-based onboarding flow.
-- The raw token is never stored — only its SHA-256 hex digest.
-- Each row links a not-yet-activated demo_invest_users row (preliminary id)
-- to a one-time activation link valid for 72 hours.

CREATE TABLE IF NOT EXISTS demo_invest_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,         -- FK to demo_invest_users.id (preliminary id, will be updated on activation)
  email       text NOT NULL,
  token_hash  text NOT NULL UNIQUE,  -- SHA-256 hex of the raw token
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,           -- NULL = not yet used
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Allow the preliminary user_id to be updated when the real auth.uid() is set.
-- We intentionally do NOT add a FK constraint here because the id changes during activation.

-- No RLS needed — this table is only accessed via the service-role admin client
-- from server-side API routes (webhook + activation endpoints).

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_demo_invest_invites_token_hash ON demo_invest_invites (token_hash);

-- Index for cleanup of old invites per user
CREATE INDEX IF NOT EXISTS idx_demo_invest_invites_user_id ON demo_invest_invites (user_id);
