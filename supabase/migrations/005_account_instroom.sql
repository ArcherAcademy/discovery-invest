ALTER TABLE public.demo_invest_users
  ADD COLUMN IF NOT EXISTS instroom text;

ALTER TABLE public.demo_invest_users
  DROP CONSTRAINT IF EXISTS demo_invest_users_instroom_check;

ALTER TABLE public.demo_invest_users
  ADD CONSTRAINT demo_invest_users_instroom_check
  CHECK (instroom IS NULL OR instroom IN ('vermogenstest', 'discovery'));

WITH geclassificeerde_logs AS (
  SELECT DISTINCT ON (lower(trim(log.email)))
    lower(trim(log.email)) AS email,
    CASE
      WHEN lower(trim(coalesce(log.payload_json ->> 'source', ''))) = 'website'
        OR lower(trim(coalesce(log.payload_json ->> 'source', ''))) LIKE '%vermogenstest%'
        OR lower(trim(coalesce(log.payload_json ->> 'page_uri', ''))) LIKE '%archerinvest.be%'
        OR lower(trim(coalesce(log.payload_json ->> 'page_uri', ''))) LIKE '%lovable.app%'
        OR lower(trim(coalesce(log.payload_json ->> 'page_uri', ''))) LIKE '%lovableproject.com%'
        OR lower(trim(coalesce(log.payload_json ->> 'page_uri', ''))) LIKE '%vermogenstest%'
        THEN 'vermogenstest'
      WHEN lower(trim(coalesce(log.payload_json ->> 'source', ''))) = 'hubspot'
        OR lower(trim(coalesce(log.payload_json ->> 'source', ''))) LIKE '%discovery%'
        OR lower(trim(coalesce(log.payload_json ->> '_bron', ''))) = 'hubspot'
        THEN 'discovery'
      WHEN lower(trim(coalesce(log.payload_json ->> '_bron', ''))) = 'website'
        THEN 'vermogenstest'
      ELSE NULL
    END AS instroom
  FROM public.demo_invest_account_webhook_log AS log
  WHERE log.email IS NOT NULL
    AND trim(log.email) <> ''
  ORDER BY lower(trim(log.email)), log.created_at DESC
)
UPDATE public.demo_invest_users AS gebruiker
SET instroom = geclassificeerde_logs.instroom
FROM geclassificeerde_logs
WHERE gebruiker.instroom IS NULL
  AND lower(trim(gebruiker.email)) = geclassificeerde_logs.email
  AND geclassificeerde_logs.instroom IS NOT NULL;
