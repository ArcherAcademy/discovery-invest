-- Bestaande gebruikers die al minstens één video hebben afgekeken, worden
-- één keer naar de nieuwe inschrijfpagina (/masterclass) gestuurd.
-- Nieuwe gebruikers krijgen standaard false en komen er via de normale flow.

alter table public.demo_invest_users
  add column if not exists masterclass_intro_pending boolean not null default false;

update public.demo_invest_users u
set masterclass_intro_pending = true
where u.role not in ('admin', 'mentor')
  and exists (
    select 1
    from public.demo_invest_video_progress p
    where p.user_id = u.id
      and p.status = 'completed'
  )
  and not exists (
    select 1
    from public.demo_invest_user_funnel f
    where f.user_id = u.id
      and f.invest_avond_geclaimd = true
  );
