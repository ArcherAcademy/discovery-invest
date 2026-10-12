alter table public.demo_invest_users
  add column if not exists phone text;

alter table public.demo_invest_account_webhook_log
  add column if not exists user_id uuid references public.demo_invest_users(id) on delete set null,
  add column if not exists submission_id uuid;

create index if not exists demo_invest_account_webhook_log_user_id_idx
  on public.demo_invest_account_webhook_log (user_id);

create index if not exists demo_invest_account_webhook_log_submission_id_idx
  on public.demo_invest_account_webhook_log (submission_id);

create table if not exists public.inflatietest_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.demo_invest_users(id) on delete cascade,
  lead_flow text not null default 'inflatietest',
  source text not null,
  submission_id uuid not null,
  submitted_at timestamptz not null,
  assigned_advisor text not null,
  answers jsonb not null,
  result text not null,
  result_details jsonb not null,
  created_at timestamptz not null default now(),
  constraint inflatietest_submissions_lead_flow_check check (lead_flow = 'inflatietest'),
  constraint inflatietest_submissions_submission_id_key unique (submission_id),
  constraint inflatietest_submissions_answers_object_check check (jsonb_typeof(answers) = 'object'),
  constraint inflatietest_submissions_result_details_object_check check (jsonb_typeof(result_details) = 'object')
);

create index if not exists inflatietest_submissions_user_id_submitted_at_idx
  on public.inflatietest_submissions (user_id, submitted_at desc);

alter table public.inflatietest_submissions enable row level security;

revoke all on table public.inflatietest_submissions from anon, authenticated;
grant all on table public.inflatietest_submissions to service_role;

update public.demo_invest_account_webhook_log as log
set
  user_id = users.id,
  submission_id = case
    when log.payload_json ->> 'submission_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (log.payload_json ->> 'submission_id')::uuid
    else null
  end
from public.demo_invest_users as users
where lower(users.email) = lower(log.email)
  and log.payload_json ->> 'source' = 'inflatietest'
  and (log.user_id is null or log.submission_id is null);

insert into public.inflatietest_submissions (
  user_id,
  lead_flow,
  source,
  submission_id,
  submitted_at,
  assigned_advisor,
  answers,
  result,
  result_details
)
select distinct on (log.submission_id)
  log.user_id,
  'inflatietest',
  'inflatietest',
  log.submission_id,
  case
    when log.payload_json ->> 'submitted_at' ~ '^\\d{4}-\\d{2}-\\d{2}T'
      then (log.payload_json ->> 'submitted_at')::timestamptz
    else log.created_at
  end,
  log.payload_json ->> 'assigned_advisor',
  log.payload_json -> 'answers',
  log.payload_json ->> 'result',
  log.payload_json -> 'result_details'
from public.demo_invest_account_webhook_log as log
where log.user_id is not null
  and log.submission_id is not null
  and log.payload_json ->> 'source' = 'inflatietest'
  and log.outcome in ('created', 'reused')
  and coalesce(log.payload_json ->> 'assigned_advisor', '') <> ''
  and coalesce(log.payload_json ->> 'result', '') <> ''
  and jsonb_typeof(log.payload_json -> 'answers') = 'object'
  and jsonb_typeof(log.payload_json -> 'result_details') = 'object'
order by log.submission_id, log.created_at asc
on conflict (submission_id) do nothing;

update public.demo_invest_users as users
set
  phone = coalesce(nullif(users.phone, ''), nullif(log.payload_json ->> 'phone', '')),
  hubspot_owner_id = coalesce(
    nullif(users.hubspot_owner_id, ''),
    case log.payload_json ->> 'assigned_advisor'
      when 'Creneau' then '78151098'
      when 'Lucas' then '36112549'
      when 'Pieter' then '35791569'
      when 'Xavier' then '1359346636'
      else null
    end
  )
from (
  select distinct on (user_id) user_id, payload_json
  from public.demo_invest_account_webhook_log
  where user_id is not null
    and payload_json ->> 'source' = 'inflatietest'
    and outcome in ('created', 'reused')
  order by user_id, created_at desc
) as log
where users.id = log.user_id
  and (
    coalesce(users.phone, '') = ''
    or coalesce(users.hubspot_owner_id, '') = ''
  );
