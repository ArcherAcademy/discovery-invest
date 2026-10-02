-- Definitieve Discovery-mailflow.
-- Bestaande triggerhistorie blijft staan; alleen oude pending-planning wordt verwijderd.

-- Dag 4 en de oude workshopflows zijn definitief uitgeschakeld.
delete from public.demo_invest_scheduled_messages
where workflow in ('dag4_inactief', 'workshop_1w_voor', 'workshop_bevestiging')
  and status in ('pending', 'sending');

delete from public.demo_invest_webhook_config
where trigger_naam in ('dag4_inactief', 'workshop_1w_voor', 'workshop_bevestiging');

insert into public.demo_invest_webhook_config (trigger_naam, label, webhook_url, actief) values
  ('opvolg_24u', 'Opvolgmail fase 1 · 24 uur', '', true),
  ('opvolg_3d', 'Opvolgmail fase 1 · 3 dagen', '', true),
  ('opvolg_5d', 'Opvolgmail fase 1 · 5 dagen', '', true),
  ('plaats_ligt_klaar', 'Je plaats ligt klaar · 48 uur na 6/6', '', true),
  ('laatste_dag', 'Vandaag is de laatste dag · dag 7 om 16u', '', true),
  ('waitlist_direct', 'Directe waitlistmail', '', true)
on conflict (trigger_naam) do update
set label = excluded.label,
    actief = true;

insert into public.demo_invest_config (sleutel, waarde) values
  ('opvolg_24u_minuten', '1440'),
  ('opvolg_3d_minuten', '4320'),
  ('opvolg_5d_minuten', '7200')
on conflict (sleutel) do update set waarde = excluded.waarde;

-- Bestaande leads krijgen de nieuwe tijdlijn direct mee; voorwaarden worden
-- opnieuw gecontroleerd vlak voor de centrale HubSpot-POST.
insert into public.demo_invest_scheduled_messages (lead_id, workflow, scheduled_for, condition_key)
select u.id, x.workflow, u.created_at + x.delay, 'not_activated'
from public.demo_invest_users u
cross join (values
  ('opvolg_24u', interval '24 hours'),
  ('opvolg_3d', interval '3 days'),
  ('opvolg_5d', interval '5 days')
) as x(workflow, delay)
where u.created_at + x.delay > now()
on conflict (lead_id, workflow) do nothing;

insert into public.demo_invest_scheduled_messages (lead_id, workflow, scheduled_for, condition_key)
select f.user_id, x.workflow, x.scheduled_for, 'completed_not_booked'
from public.demo_invest_user_funnel f
cross join lateral (values
  ('plaats_ligt_klaar', f.all_completed_at + interval '48 hours'),
  ('laatste_dag', (((f.all_completed_at at time zone 'Europe/Brussels')::date + 7 + time '16:00') at time zone 'Europe/Brussels'))
  ) as x(workflow, scheduled_for)
where f.all_completed_at is not null
  and x.scheduled_for > now()
on conflict (lead_id, workflow) do nothing;
