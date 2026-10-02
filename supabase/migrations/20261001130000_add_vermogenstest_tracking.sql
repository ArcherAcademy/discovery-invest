alter table public.demo_invest_users
  add column if not exists lead_flow text null,
  add column if not exists vermogenstest_variant text null,
  add column if not exists vermogenstest_vragenset text null;

-- Vul de instroom aan vanuit de nieuwste geslaagde accountwebhook per e-mailadres.
with nieuwste_webhook as (
  select distinct on (lower(email))
    lower(email) as email_key,
    nullif(payload_json ->> 'lead_flow', '') as lead_flow
  from public.demo_invest_account_webhook_log
  where email is not null
    and outcome in ('created', 'reused')
  order by lower(email), created_at desc, id desc
)
update public.demo_invest_users as gebruiker
set lead_flow = webhook.lead_flow
from nieuwste_webhook as webhook
where lower(gebruiker.email) = webhook.email_key
  and gebruiker.lead_flow is null
  and webhook.lead_flow is not null;

-- Neem alleen geldige A/oud en B/nieuw-koppelingen over. Bestaande waarden
-- blijven staan; een leeg veld wordt alleen aangevuld als de combinatie klopt.
with nieuwste_webhook as (
  select distinct on (lower(email))
    lower(email) as email_key,
    payload_json ->> 'vermogenstest_variant' as variant,
    payload_json ->> 'vermogenstest_vragenset' as vragenset
  from public.demo_invest_account_webhook_log
  where email is not null
    and outcome in ('created', 'reused')
    and (
      (payload_json ->> 'vermogenstest_variant' = 'A' and payload_json ->> 'vermogenstest_vragenset' = 'oude_vragen')
      or (payload_json ->> 'vermogenstest_variant' = 'B' and payload_json ->> 'vermogenstest_vragenset' = 'nieuwe_vragen')
    )
  order by lower(email), created_at desc, id desc
)
update public.demo_invest_users as gebruiker
set
  vermogenstest_variant = coalesce(gebruiker.vermogenstest_variant, webhook.variant),
  vermogenstest_vragenset = coalesce(gebruiker.vermogenstest_vragenset, webhook.vragenset)
from nieuwste_webhook as webhook
where lower(gebruiker.email) = webhook.email_key
  and (gebruiker.vermogenstest_variant is null or gebruiker.vermogenstest_variant = webhook.variant)
  and (gebruiker.vermogenstest_vragenset is null or gebruiker.vermogenstest_vragenset = webhook.vragenset)
  and (gebruiker.vermogenstest_variant is null or gebruiker.vermogenstest_vragenset is null);

alter table public.demo_invest_users
  drop constraint if exists demo_invest_users_vermogenstest_variant_check,
  drop constraint if exists demo_invest_users_vermogenstest_vragenset_check,
  drop constraint if exists demo_invest_users_vermogenstest_pair_check;

alter table public.demo_invest_users
  add constraint demo_invest_users_vermogenstest_variant_check
    check (vermogenstest_variant is null or vermogenstest_variant in ('A', 'B')),
  add constraint demo_invest_users_vermogenstest_vragenset_check
    check (vermogenstest_vragenset is null or vermogenstest_vragenset in ('oude_vragen', 'nieuwe_vragen')),
  add constraint demo_invest_users_vermogenstest_pair_check
    check (
      (vermogenstest_variant is null and vermogenstest_vragenset is null)
      or (vermogenstest_variant = 'A' and vermogenstest_vragenset = 'oude_vragen')
      or (vermogenstest_variant = 'B' and vermogenstest_vragenset = 'nieuwe_vragen')
    );
