-- Gerichte workflow-evaluator: database selecteert kandidaten, app verstuurt.
-- Deze migratie is additief en verwijdert of wijzigt geen bestaande verzendhistoriek.

create table if not exists public.demo_invest_evaluator_lease (
  lease_name text primary key,
  owner_id uuid not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_invest_evaluator_run (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('bezig', 'voltooid', 'overgeslagen', 'gefaald')),
  candidates integer not null default 0,
  triggered integer not null default 0,
  suppressed integer not null default 0,
  failed integer not null default 0,
  duration_ms integer,
  details jsonb not null default '{}'::jsonb
);

create index if not exists demo_invest_evaluator_run_started_idx
  on public.demo_invest_evaluator_run (started_at desc);

create index if not exists demo_invest_users_unactivated_created_idx
  on public.demo_invest_users (created_at) where activated_at is null;
create index if not exists demo_invest_users_activity_idx
  on public.demo_invest_users (coalesce(last_activity_at, activated_at));
create index if not exists demo_invest_users_trial_expiry_idx
  on public.demo_invest_users (trial_expires_at) where trial_expires_at is not null;
create index if not exists demo_invest_funnel_completed_idx
  on public.demo_invest_user_funnel (all_completed_at) where all_completed_at is not null;
create index if not exists demo_invest_bookings_user_status_idx
  on public.demo_invest_event_bookings (user_id, status, event_id);
create index if not exists demo_invest_trigger_sent_workflow_created_idx
  on public.demo_invest_trigger_sent (workflow_naam, created_at, user_id);

create table if not exists public.demo_invest_trigger_delivery (
  user_id uuid not null references public.demo_invest_users(id) on delete cascade,
  workflow_naam text not null,
  claim_token uuid not null,
  status text not null check (status in ('bezig', 'verstuurd')),
  lease_until timestamptz not null,
  response_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, workflow_naam)
);

alter table public.demo_invest_evaluator_lease enable row level security;
alter table public.demo_invest_evaluator_run enable row level security;
alter table public.demo_invest_trigger_delivery enable row level security;

create or replace function public.demo_invest_acquire_evaluator_lease(
  p_owner uuid,
  p_ttl_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired boolean := false;
begin
  insert into public.demo_invest_evaluator_lease (lease_name, owner_id, lease_until, updated_at)
  values ('workflow-evaluator', p_owner, now() + make_interval(secs => p_ttl_seconds), now())
  on conflict (lease_name) do update
    set owner_id = excluded.owner_id,
        lease_until = excluded.lease_until,
        updated_at = now()
    where public.demo_invest_evaluator_lease.lease_until < now()
       or public.demo_invest_evaluator_lease.owner_id = p_owner
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.demo_invest_release_evaluator_lease(p_owner uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.demo_invest_evaluator_lease
  where lease_name = 'workflow-evaluator' and owner_id = p_owner;
$$;

create or replace function public.demo_invest_claim_delivery(
  p_user_id uuid,
  p_workflow_naam text,
  p_claim_token uuid,
  p_ttl_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired boolean := false;
begin
  if exists (
    select 1 from public.demo_invest_trigger_sent
    where user_id = p_user_id and workflow_naam = p_workflow_naam
  ) then
    return false;
  end if;

  insert into public.demo_invest_trigger_delivery (
    user_id, workflow_naam, claim_token, status, lease_until, created_at, updated_at
  ) values (
    p_user_id, p_workflow_naam, p_claim_token, 'bezig',
    now() + make_interval(secs => p_ttl_seconds), now(), now()
  )
  on conflict (user_id, workflow_naam) do update
    set claim_token = excluded.claim_token,
        status = 'bezig',
        lease_until = excluded.lease_until,
        updated_at = now()
    where public.demo_invest_trigger_delivery.status = 'bezig'
      and public.demo_invest_trigger_delivery.lease_until < now()
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.demo_invest_finalize_delivery(
  p_user_id uuid,
  p_workflow_naam text,
  p_claim_token uuid,
  p_response_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.demo_invest_trigger_delivery
    where user_id = p_user_id
      and workflow_naam = p_workflow_naam
      and claim_token = p_claim_token
      and status = 'bezig'
  ) then
    return false;
  end if;

  insert into public.demo_invest_trigger_sent (user_id, workflow_naam)
  values (p_user_id, p_workflow_naam)
  on conflict (user_id, workflow_naam) do nothing;

  update public.demo_invest_trigger_delivery
  set status = 'verstuurd',
      response_status = p_response_status,
      lease_until = 'infinity'::timestamptz,
      updated_at = now()
  where user_id = p_user_id
    and workflow_naam = p_workflow_naam
    and claim_token = p_claim_token;

  return true;
end;
$$;

create or replace function public.demo_invest_release_delivery(
  p_user_id uuid,
  p_workflow_naam text,
  p_claim_token uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.demo_invest_trigger_delivery
  where user_id = p_user_id
    and workflow_naam = p_workflow_naam
    and claim_token = p_claim_token
    and status = 'bezig';
$$;

create or replace function public.demo_invest_workflow_candidates(
  p_workflow_naam text,
  p_now timestamptz default now(),
  p_lookback_minutes integer default 30,
  p_limit integer default 250
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  threshold_minutes integer;
  desired_video_order integer;
  video_cap integer := coalesce((
    select waarde::integer from public.demo_invest_config where sleutel = 'video_nudge_cap'
  ), 5);
  window_start timestamptz := p_now - make_interval(mins => p_lookback_minutes);
begin
  if p_workflow_naam not in (
    'activatie_2u', 'activatie_24u', 'activatie_72u',
    'video_2_herinnering', 'video_3_herinnering', 'video_4_herinnering',
    'video_5_herinnering', 'video_6_herinnering', 'dag4_inactief',
    'workshop_1w_voor', 'trial_verlopen', 'verloopt_5d', 'verloopt_3d',
    'verloopt_1d', 'verloopt_6u'
  ) then
    return;
  end if;

  threshold_minutes := case p_workflow_naam
    when 'activatie_2u' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'activatie_2u_minuten'), 120)
    when 'activatie_24u' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'activatie_24u_minuten'), 1440)
    when 'activatie_72u' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'activatie_72u_minuten'), 4320)
    when 'video_2_herinnering' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'inactiviteit_minuten'), 1440)
    when 'video_3_herinnering' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'inactiviteit_minuten'), 1440)
    when 'video_4_herinnering' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'inactiviteit_minuten'), 1440)
    when 'video_5_herinnering' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'inactiviteit_minuten'), 1440)
    when 'video_6_herinnering' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'inactiviteit_minuten'), 1440)
    when 'dag4_inactief' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'dag4_minuten'), 5760)
    when 'workshop_1w_voor' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'workshop_nudge_w1_minuten'), 10080)
    when 'verloopt_5d' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'verloopt_5d_minuten'), 7200)
    when 'verloopt_3d' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'verloopt_3d_minuten'), 4320)
    when 'verloopt_1d' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'verloopt_1d_minuten'), 1440)
    when 'verloopt_6u' then coalesce((select waarde::integer from public.demo_invest_config where sleutel = 'verloopt_6u_minuten'), 360)
    else 0
  end;

  desired_video_order := case p_workflow_naam
    when 'video_2_herinnering' then 2
    when 'video_3_herinnering' then 3
    when 'video_4_herinnering' then 4
    when 'video_5_herinnering' then 5
    when 'video_6_herinnering' then 6
    else null
  end;

  return query
  select distinct u.id
  from public.demo_invest_users u
  left join public.demo_invest_user_funnel f on f.user_id = u.id
  where not exists (
      select 1 from public.demo_invest_trigger_sent s
      where s.user_id = u.id and s.workflow_naam = p_workflow_naam
    )
    and not exists (
      select 1 from public.demo_invest_trigger_sent disabled
      where disabled.user_id = u.id and disabled.workflow_naam = '__automatische_opvolging_uit__'
    )
    and not exists (
      select 1 from public.demo_invest_trigger_delivery d
      where d.user_id = u.id and d.workflow_naam = p_workflow_naam
        and (d.status = 'verstuurd' or d.lease_until >= p_now)
    )
    and case
      when p_workflow_naam in ('activatie_2u', 'activatie_24u', 'activatie_72u') then
        u.activated_at is null
        and u.created_at + make_interval(mins => threshold_minutes) > window_start
        and u.created_at + make_interval(mins => threshold_minutes) <= p_now

      when desired_video_order is not null then
        u.activated_at is not null
        and f.all_completed_at is null
        and coalesce(u.last_activity_at, u.activated_at) + make_interval(mins => threshold_minutes) > window_start
        and coalesce(u.last_activity_at, u.activated_at) + make_interval(mins => threshold_minutes) <= p_now
        and desired_video_order = (
          select min(v.order_no)
          from public.demo_invest_videos v
          where v.section = 'core'
            and not exists (
              select 1 from public.demo_invest_video_progress p
              where p.user_id = u.id and p.video_id = v.id and p.status = 'completed'
            )
        )
        and (
          select count(*) from public.demo_invest_trigger_sent vs
          where vs.user_id = u.id
            and vs.workflow_naam in (
              'video_2_herinnering', 'video_3_herinnering', 'video_4_herinnering',
              'video_5_herinnering', 'video_6_herinnering'
            )
        ) < video_cap
        and not exists (
          select 1 from public.demo_invest_trigger_sent recent
          where recent.user_id = u.id
            and recent.workflow_naam in (
              'video_2_herinnering', 'video_3_herinnering', 'video_4_herinnering',
              'video_5_herinnering', 'video_6_herinnering'
            )
            and recent.created_at > p_now - interval '24 hours'
        )

      when p_workflow_naam = 'dag4_inactief' then
        f.all_completed_at is not null
        and not coalesce(f.event_booked, false)
        and f.all_completed_at + make_interval(mins => threshold_minutes) > window_start
        and f.all_completed_at + make_interval(mins => threshold_minutes) <= p_now

      when p_workflow_naam = 'workshop_1w_voor' then
        exists (
          select 1
          from public.demo_invest_event_bookings b
          join public.demo_invest_events e on e.id = b.event_id
          where b.user_id = u.id
            and b.status = 'booked'
            and e.starts_at - make_interval(mins => threshold_minutes) > window_start
            and e.starts_at - make_interval(mins => threshold_minutes) <= p_now
        )

      when p_workflow_naam = 'trial_verlopen' then
        not coalesce(f.event_booked, false)
        and u.trial_expires_at > window_start
        and u.trial_expires_at <= p_now

      when p_workflow_naam in ('verloopt_5d', 'verloopt_3d', 'verloopt_1d', 'verloopt_6u') then
        u.activated_at is not null
        and u.trial_expires_at is not null
        and not coalesce(f.event_booked, false)
        and u.activated_at <= u.trial_expires_at - make_interval(mins => threshold_minutes)
        and u.trial_expires_at - make_interval(mins => threshold_minutes) > window_start
        and u.trial_expires_at - make_interval(mins => threshold_minutes) <= p_now

      else false
    end
  order by u.id
  limit greatest(1, least(p_limit, 1000));
end;
$$;

revoke all on function public.demo_invest_acquire_evaluator_lease(uuid, integer) from public, anon, authenticated;
revoke all on function public.demo_invest_release_evaluator_lease(uuid) from public, anon, authenticated;
revoke all on function public.demo_invest_claim_delivery(uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.demo_invest_finalize_delivery(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.demo_invest_release_delivery(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.demo_invest_workflow_candidates(text, timestamptz, integer, integer) from public, anon, authenticated;

grant execute on function public.demo_invest_acquire_evaluator_lease(uuid, integer) to service_role;
grant execute on function public.demo_invest_release_evaluator_lease(uuid) to service_role;
grant execute on function public.demo_invest_claim_delivery(uuid, text, uuid, integer) to service_role;
grant execute on function public.demo_invest_finalize_delivery(uuid, text, uuid, text) to service_role;
grant execute on function public.demo_invest_release_delivery(uuid, text, uuid) to service_role;
grant execute on function public.demo_invest_workflow_candidates(text, timestamptz, integer, integer) to service_role;
