-- Workshop/event-mails zijn uitgefaseerd uit de officiële Discovery-flow.
-- Verzonden historie blijft behouden; alleen nog niet uitgevoerde werk wordt gestopt.

update public.demo_invest_webhook_config
set actief = false
where trigger_naam in ('workshop_1w_voor', 'workshop_bevestiging');

delete from public.demo_invest_scheduled_messages
where workflow in ('workshop_1w_voor', 'workshop_bevestiging')
  and status = 'pending';
