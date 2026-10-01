-- Deze migratie hoort pas te draaien nadat scripts/repair-duplicate-demo-users.mjs
-- alle historische duplicaten heeft geconsolideerd.
-- De FK-indexen voorkomen statement-time-outs bij het definitief verwijderen.
create index if not exists demo_invest_trigger_delivery_user_idx on public.demo_invest_trigger_delivery (user_id);
create index if not exists demo_invest_invites_user_idx on public.demo_invest_invites (user_id);
create index if not exists demo_invest_trigger_sent_user_idx on public.demo_invest_trigger_sent (user_id);
create index if not exists demo_invest_quiz_submissions_user_idx on public.demo_invest_quiz_submissions (user_id);
create index if not exists demo_invest_scheduled_messages_lead_idx on public.demo_invest_scheduled_messages (lead_id);
create index if not exists demo_invest_webhook_log_user_idx on public.demo_invest_webhook_log (user_id);
create index if not exists demo_invest_user_funnel_user_idx on public.demo_invest_user_funnel (user_id);
create index if not exists demo_invest_vermogensscan_user_idx on public.demo_invest_vermogensscan (user_id);
create index if not exists demo_invest_sessions_user_idx on public.demo_invest_sessions (user_id);
create index if not exists demo_invest_event_bookings_user_idx on public.demo_invest_event_bookings (user_id);
create index if not exists demo_invest_trigger_log_user_idx on public.demo_invest_trigger_log (user_id);
create index if not exists demo_invest_video_progress_user_idx on public.demo_invest_video_progress (user_id);

delete from public.demo_invest_users
where email like 'merged-%@invalid.archer.local';

update public.demo_invest_users
set email = pg_catalog.lower(pg_catalog.btrim(email))
where email is distinct from pg_catalog.lower(pg_catalog.btrim(email));

create unique index if not exists demo_invest_users_email_normalized_unique
  on public.demo_invest_users (pg_catalog.lower(pg_catalog.btrim(email)))
  where email is not null and pg_catalog.btrim(email) <> '';
