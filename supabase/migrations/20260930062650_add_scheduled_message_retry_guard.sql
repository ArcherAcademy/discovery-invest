alter table public.demo_invest_scheduled_messages
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists failed_at timestamptz;

alter table public.demo_invest_scheduled_messages
  drop constraint if exists demo_invest_scheduled_messages_status_check;

alter table public.demo_invest_scheduled_messages
  add constraint demo_invest_scheduled_messages_status_check
  check (status in ('pending', 'sending', 'sent', 'cancelled', 'skipped', 'failed'));

create or replace function public.demo_invest_fail_scheduled_message(
  p_id uuid,
  p_claim_token uuid,
  p_error text,
  p_max_attempts integer default 5
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  next_retry_count integer;
  next_status text;
begin
  select retry_count + 1
  into next_retry_count
  from public.demo_invest_scheduled_messages
  where id = p_id and status = 'sending' and claim_token = p_claim_token
  for update;

  if next_retry_count is null then
    return 'claim_lost';
  end if;

  next_status := case
    when next_retry_count >= pg_catalog.greatest(1, p_max_attempts) then 'failed'
    else 'pending'
  end;

  update public.demo_invest_scheduled_messages
  set status = next_status,
      retry_count = next_retry_count,
      last_error = pg_catalog.left(p_error, 2000),
      failed_at = case when next_status = 'failed' then pg_catalog.now() else null end,
      claim_token = null,
      claim_until = null
  where id = p_id and status = 'sending' and claim_token = p_claim_token;

  return next_status;
end;
$$;

revoke all on function public.demo_invest_fail_scheduled_message(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.demo_invest_fail_scheduled_message(uuid, uuid, text, integer) to service_role;
