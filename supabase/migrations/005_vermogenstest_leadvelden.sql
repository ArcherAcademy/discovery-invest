-- Slaat de expliciete instroom en Vermogenstest-variant per account op.
-- Bestaande accounts blijven ongewijzigd; alle velden zijn bewust nullable.

ALTER TABLE public.demo_invest_users
  ADD COLUMN IF NOT EXISTS lead_flow text,
  ADD COLUMN IF NOT EXISTS vermogenstest_variant text,
  ADD COLUMN IF NOT EXISTS vermogenstest_vragenset text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'demo_invest_users_lead_flow_check'
      AND conrelid = 'public.demo_invest_users'::regclass
  ) THEN
    ALTER TABLE public.demo_invest_users
      ADD CONSTRAINT demo_invest_users_lead_flow_check
      CHECK (lead_flow IS NULL OR lead_flow IN ('vermogenstest', 'demo', 'onbekend'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'demo_invest_users_vermogenstest_variant_check'
      AND conrelid = 'public.demo_invest_users'::regclass
  ) THEN
    ALTER TABLE public.demo_invest_users
      ADD CONSTRAINT demo_invest_users_vermogenstest_variant_check
      CHECK (vermogenstest_variant IS NULL OR vermogenstest_variant IN ('A', 'B'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'demo_invest_users_vermogenstest_vragenset_check'
      AND conrelid = 'public.demo_invest_users'::regclass
  ) THEN
    ALTER TABLE public.demo_invest_users
      ADD CONSTRAINT demo_invest_users_vermogenstest_vragenset_check
      CHECK (vermogenstest_vragenset IS NULL OR vermogenstest_vragenset IN ('oude_vragen', 'nieuwe_vragen'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
