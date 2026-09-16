ALTER TABLE public.demo_invest_users
  ADD COLUMN IF NOT EXISTS instroom text;

ALTER TABLE public.demo_invest_users
  DROP CONSTRAINT IF EXISTS demo_invest_users_instroom_check;

ALTER TABLE public.demo_invest_users
  ADD CONSTRAINT demo_invest_users_instroom_check
  CHECK (instroom IS NULL OR instroom IN ('vermogenstest', 'discovery'));

WITH herkenbare_logs AS (
  SELECT
    lower(trim(log.email)) AS email,
    log.created_at,
    CASE
      WHEN lower(coalesce(
        log.payload_json ->> 'page_uri',
        log.payload_json ->> 'page_url',
        log.payload_json ->> 'url',
        ''
      )) ~ '^https?://[^/]+/demo([/?#]|$)'
        OR lower(trim(coalesce(log.payload_json ->> 'source', ''))) LIKE '%discovery%'
        THEN 'discovery'
      WHEN lower(coalesce(
        log.payload_json ->> 'page_uri',
        log.payload_json ->> 'page_url',
        log.payload_json ->> 'url',
        ''
      )) ~ '^https?://[^/]+/vermogens-test([/?#]|$)'
        OR lower(trim(coalesce(log.payload_json ->> 'source', ''))) LIKE '%vermogenstest%'
        THEN 'vermogenstest'
      ELSE NULL
    END AS instroom
  FROM public.demo_invest_account_webhook_log AS log
  WHERE log.email IS NOT NULL
    AND trim(log.email) <> ''
),
eerste_instroombron AS (
  SELECT DISTINCT ON (email)
    email,
    instroom
  FROM herkenbare_logs
  WHERE instroom IS NOT NULL
  ORDER BY email, created_at ASC
)
UPDATE public.demo_invest_users AS gebruiker
SET instroom = eerste_instroombron.instroom
FROM eerste_instroombron
WHERE lower(trim(gebruiker.email)) = eerste_instroombron.email;
