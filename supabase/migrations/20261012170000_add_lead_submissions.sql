alter table public.demo_invest_users
  add column if not exists phone text,
  add column if not exists lead_flow text,
  add column if not exists vermogenstest_variant text,
  add column if not exists vermogenstest_vragenset text;

alter table public.demo_invest_account_webhook_log
  add column if not exists user_id uuid references public.demo_invest_users(id) on delete set null,
  add column if not exists submission_id uuid;

create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.demo_invest_users(id) on delete cascade,
  submission_id uuid not null unique,
  lead_flow text not null,
  source text not null,
  variant text,
  vragenset text,
  assigned_advisor text,
  answers_labeled jsonb not null default '[]'::jsonb,
  answers_raw jsonb not null default '{}'::jsonb,
  result text,
  result_details jsonb not null default '{}'::jsonb,
  score numeric,
  extra jsonb not null default '{}'::jsonb,
  utm_source text,
  utm_campaign text,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint lead_submissions_answers_labeled_array_check check (jsonb_typeof(answers_labeled) = 'array'),
  constraint lead_submissions_answers_raw_valid_check check (jsonb_typeof(answers_raw) in ('array', 'object')),
  constraint lead_submissions_result_details_object_check check (jsonb_typeof(result_details) = 'object'),
  constraint lead_submissions_variant_check check (variant is null or variant in ('A', 'B')),
  constraint lead_submissions_vragenset_check check (vragenset is null or vragenset in ('oude_vragen', 'nieuwe_vragen'))
);

create index if not exists lead_submissions_user_submitted_idx
  on public.lead_submissions (user_id, submitted_at desc, created_at desc);
create index if not exists lead_submissions_flow_idx
  on public.lead_submissions (lead_flow);
create index if not exists demo_invest_account_webhook_log_user_id_idx
  on public.demo_invest_account_webhook_log (user_id);
create index if not exists demo_invest_account_webhook_log_submission_id_idx
  on public.demo_invest_account_webhook_log (submission_id);

-- Voor een tabel die al bestond zonder deze kolom.
alter table public.lead_submissions add column if not exists extra jsonb not null default '{}'::jsonb;

-- RLS aan zonder policies: anon en authenticated lezen niets, ook de gebruiker
-- zelf niet. Alleen de service role (server-side, achter requireAdminOrMentor
-- in /api/admin/data) heeft toegang.
alter table public.lead_submissions enable row level security;
revoke all on table public.lead_submissions from anon, authenticated;
grant all on table public.lead_submissions to service_role;
drop policy if exists lead_submissions_admin_select on public.lead_submissions;

do $migration$
begin
  if to_regclass('public.inflatietest_submissions') is not null then
    execute $sql$
      insert into public.lead_submissions (
        user_id, submission_id, lead_flow, source, assigned_advisor,
        answers_labeled, answers_raw, result, result_details, submitted_at, created_at
      )
      select
        user_id, submission_id, 'inflatietest', 'Inflatietest', assigned_advisor,
        '[]'::jsonb, answers, result, result_details, submitted_at, created_at
      from public.inflatietest_submissions
      on conflict (submission_id) do nothing
    $sql$;
  end if;
end
$migration$;

with geldige_logs as (
  select distinct on (log.payload_json ->> 'submission_id')
    users.id as user_id,
    (log.payload_json ->> 'submission_id')::uuid as submission_id,
    case
      when coalesce(nullif(log.payload_json ->> 'lead_flow', ''), case when log.payload_json ->> 'source' = 'discovery' then 'demo' else nullif(log.payload_json ->> 'source', '') end) in ('vermogenstest', 'demo', 'inflatietest', 'eenprocenttest') then coalesce(nullif(log.payload_json ->> 'lead_flow', ''), case when log.payload_json ->> 'source' = 'discovery' then 'demo' else nullif(log.payload_json ->> 'source', '') end)
      else 'onbekend'
    end as lead_flow,
    case coalesce(nullif(log.payload_json ->> 'lead_flow', ''), case when log.payload_json ->> 'source' = 'discovery' then 'demo' else nullif(log.payload_json ->> 'source', '') end)
      when 'vermogenstest' then 'Vermogenstest'
      when 'demo' then 'Discovery-aanvraag'
      when 'inflatietest' then 'Inflatietest'
      when 'eenprocenttest' then '1%-test'
      else 'onbekend'
    end as source,
    nullif(log.payload_json ->> 'vermogenstest_variant', '') as variant,
    nullif(log.payload_json ->> 'vermogenstest_vragenset', '') as vragenset,
    nullif(log.payload_json ->> 'assigned_advisor', '') as assigned_advisor,
    case
      when coalesce(nullif(log.payload_json ->> 'lead_flow', ''), case when log.payload_json ->> 'source' = 'discovery' then 'demo' else nullif(log.payload_json ->> 'source', '') end) in ('inflatietest', 'eenprocenttest') and jsonb_typeof(log.payload_json -> 'answers_labeled') = 'array'
        then log.payload_json -> 'answers_labeled'
      when coalesce(nullif(log.payload_json ->> 'lead_flow', ''), case when log.payload_json ->> 'source' = 'discovery' then 'demo' else nullif(log.payload_json ->> 'source', '') end) = 'vermogenstest' and jsonb_typeof(log.payload_json -> 'answers') = 'array'
        then log.payload_json -> 'answers'
      when coalesce(nullif(log.payload_json ->> 'lead_flow', ''), case when log.payload_json ->> 'source' = 'discovery' then 'demo' else nullif(log.payload_json ->> 'source', '') end) = 'demo' and jsonb_typeof(log.payload_json -> 'discovery_answers') = 'object'
        then coalesce((
          select jsonb_agg(jsonb_build_object(
            'question_id', item.key,
            'question', item.value ->> 'question',
            'answer', item.value ->> 'answer',
            'value', item.value -> 'answer_value'
          ) order by item.ordinality)
          from jsonb_each(log.payload_json -> 'discovery_answers') with ordinality as item(key, value, ordinality)
        ), '[]'::jsonb)
      else '[]'::jsonb
    end as answers_labeled,
    case
      when jsonb_typeof(log.payload_json -> 'answers') in ('array', 'object') then log.payload_json -> 'answers'
      when jsonb_typeof(log.payload_json -> 'discovery_answers') = 'object' then log.payload_json -> 'discovery_answers'
      else '{}'::jsonb
    end as answers_raw,
    nullif(log.payload_json ->> 'result', '') as result,
    case when jsonb_typeof(log.payload_json -> 'result_details') = 'object' then log.payload_json -> 'result_details' else '{}'::jsonb end as result_details,
    case when log.payload_json ->> 'score' ~ '^-?[0-9]+([.][0-9]+)?$' then (log.payload_json ->> 'score')::numeric else null end as score,
    nullif(log.payload_json ->> 'utm_source', '') as utm_source,
    nullif(log.payload_json ->> 'utm_campaign', '') as utm_campaign,
    case when log.payload_json ->> 'submitted_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then (log.payload_json ->> 'submitted_at')::timestamptz else log.created_at end as submitted_at,
    log.created_at
  from public.demo_invest_account_webhook_log as log
  join public.demo_invest_users as users on lower(users.email) = lower(log.email)
  where log.outcome in ('created', 'reused')
    and log.payload_json ->> 'submission_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  order by log.payload_json ->> 'submission_id', log.created_at asc, log.id asc
)
insert into public.lead_submissions (
  user_id, submission_id, lead_flow, source, variant, vragenset,
  assigned_advisor, answers_labeled, answers_raw, result, result_details,
  score, utm_source, utm_campaign, submitted_at, created_at
)
select
  user_id, submission_id, lead_flow, source, variant, vragenset,
  assigned_advisor, answers_labeled, answers_raw, result, result_details,
  score, utm_source, utm_campaign, submitted_at, created_at
from geldige_logs
on conflict (submission_id) do nothing;

notify pgrst, 'reload schema';
