/**
 * Archer Invest Demo — Workflow Orchestrator
 *
 * Stricte regels (zie spec):
 *
 * 1. NOOIT VOORUIT PLANNEN — beslissing valt pas op het moment van verzenden.
 * 2. VERSE HERLEZING vlak voor elke verzending — state wordt opnieuw gelezen
 *    uit Supabase, niet vertrouwd op eerder gebulkte data.
 * 3. HARDE DATABASEGRENDEL — INSERT in demo_invest_trigger_sent met UNIQUE
 *    (user_id, workflow_naam). Een dubbele run faalt fysiek op de constraint.
 * 4. EERST WEGSCHRIJVEN, DAN STUREN — volgorde: INSERT trigger_sent →
 *    verse voorwaardecheck → webhook → log.
 * 5. ONDERDRUKKING BIJ TOESTANDSWIJZIGING — evaluator toetst altijd verse
 *    state, vertrouwt nooit blind op eerdere instant-event-onderdrukking.
 * 6. ALLES LOGGEN — elke beslissing (verstuurd / onderdrukt / gefaald /
 *    no_endpoint) in demo_invest_trigger_log.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { HUBSPOT_CODE } from '@/lib/hubspot-codes'
import { getCallUserState, resolveBookingLink } from '@/lib/call-booking-data'
import type {
  DemoUser,
  DemoUserFunnel,
  DemoWebhookConfig,
  DemoConfig,
  DemoVideoProgress,
  TriggerStatus,
} from './types'

// ── Workflow definitions ─────────────────────────────────────

export interface WorkflowDef {
  nummer: number
  naam: string
  label: string
  type: 'instant' | 'klok'
  fase: string
  voorwaarde: string
  timing: string
  suppressie: string
}

export const WORKFLOWS: WorkflowDef[] = [
  // Fase 1 — Activatie
  { nummer: 1,  naam: 'welkom',               label: 'Welkom na activatie',              type: 'instant', fase: 'Activatie',  voorwaarde: 'Nieuw account aangemaakt of eerste activatie',           timing: 'Direct',                          suppressie: 'Send-once' },
  { nummer: 2,  naam: 'activatie_2u',         label: 'Niet geactiveerd na 2 uur',        type: 'klok',    fase: 'Activatie',  voorwaarde: 'activated_at IS NULL, 2u na created_at',                 timing: '2 uur na created_at',             suppressie: 'Send-once, permanent stop zodra activated_at gezet' },
  { nummer: 3,  naam: 'activatie_24u',        label: 'Niet geactiveerd na 24 uur',       type: 'klok',    fase: 'Activatie',  voorwaarde: 'activated_at IS NULL, 24u na created_at',                timing: '24 uur na created_at',            suppressie: 'Send-once, permanent stop zodra activated_at gezet' },
  { nummer: 4,  naam: 'activatie_72u',        label: 'Niet geactiveerd na 72 uur',       type: 'klok',    fase: 'Activatie',  voorwaarde: 'activated_at IS NULL, 72u na created_at',                timing: '72 uur na created_at',            suppressie: 'Send-once, permanent stop zodra activated_at gezet' },
  // Fase 2 — Video engagement
  // GEEN herinnering voor video 1 — na activatie start video 1 vanzelf.
  // Herinneringen zijn voor video 2 t/m 6 (de eerstvolgende ongeziene).
  { nummer: 5,  naam: 'video_2_herinnering',  label: 'Herinnering video 2',              type: 'klok',    fase: 'Videos',     voorwaarde: 'Geactiveerd, inactief 24u, video 2 eerstvolgende',       timing: '24u inactiviteit na last_activity_at', suppressie: 'Send-once, freq-cap 1/24u + max 5 totaal' },
  { nummer: 6,  naam: 'video_3_herinnering',  label: 'Herinnering video 3',              type: 'klok',    fase: 'Videos',     voorwaarde: 'Geactiveerd, inactief 24u, video 3 eerstvolgende',       timing: '24u inactiviteit na last_activity_at', suppressie: 'Send-once, freq-cap 1/24u + max 5 totaal' },
  { nummer: 7,  naam: 'video_4_herinnering',  label: 'Herinnering video 4',              type: 'klok',    fase: 'Videos',     voorwaarde: 'Geactiveerd, inactief 24u, video 4 eerstvolgende',       timing: '24u inactiviteit na last_activity_at', suppressie: 'Send-once, freq-cap 1/24u + max 5 totaal' },
  { nummer: 8,  naam: 'video_5_herinnering',  label: 'Herinnering video 5',              type: 'klok',    fase: 'Videos',     voorwaarde: 'Geactiveerd, inactief 24u, video 5 eerstvolgende',       timing: '24u inactiviteit na last_activity_at', suppressie: 'Send-once, freq-cap 1/24u + max 5 totaal' },
  { nummer: 9,  naam: 'video_6_herinnering',  label: 'Herinnering video 6',              type: 'klok',    fase: 'Videos',     voorwaarde: 'Geactiveerd, inactief 24u, video 6 eerstvolgende',       timing: '24u inactiviteit na last_activity_at', suppressie: 'Send-once, freq-cap 1/24u + max 5 totaal' },
  // Fase 3 — Conversie
  { nummer: 10, naam: 'alles_gezien_c1',      label: "Alle 6 kernvideo's bekeken",        type: 'instant', fase: 'Conversie',  voorwaarde: 'all_completed_at net gezet',                   timing: 'Direct na voltooiing video 6',   suppressie: 'Send-once' },
  { nummer: 11, naam: 'dag4_inactief',        label: 'Dag 4 inactief na voltooiing',      type: 'klok',    fase: 'Conversie',  voorwaarde: 'all_completed_at gezet, event_booked = false', timing: '4 dagen na all_completed_at',    suppressie: 'Send-once, stop als event geboekt' },
  { nummer: 12, naam: 'workshop_1w_voor',     label: '1 week voor workshop',              type: 'klok',    fase: 'Conversie',  voorwaarde: 'event_booked = true, event 7 dagen weg',       timing: '7 dagen voor event starts_at',   suppressie: 'Send-once per boeking' },
  // Fase 4 — Retentie
  { nummer: 13, naam: 'workshop_bevestiging', label: 'Workshop boeking bevestigd',        type: 'instant', fase: 'Retentie',   voorwaarde: 'event_booked net op true gezet',               timing: 'Direct na boeking',              suppressie: 'Send-once per boeking' },
  { nummer: 14, naam: 'trial_verlopen',       label: 'Trial verlopen zonder boeking',     type: 'klok',    fase: 'Retentie',   voorwaarde: 'trial_expires_at verstreken, event_booked = false', timing: 'Bij/na trial_expires_at', suppressie: 'Send-once' },
  // Fase 5 — Trial verloopreminders (gaan alleen af als het venster nog niet gepasseerd was bij activatie)
  { nummer: 15, naam: 'verloopt_5d',          label: 'Trial verloopt over 5 dagen',       type: 'klok',    fase: 'Retentie',   voorwaarde: 'trial_expires_at over ≤5d, event_booked = false, geactiveerd', timing: 'Wanneer minutesUntil(trial_expires_at) ≤ verloopt_5d_minuten', suppressie: 'Send-once, stop als event geboekt of venster al gepasseerd bij activatie' },
  { nummer: 16, naam: 'verloopt_3d',          label: 'Trial verloopt over 3 dagen',       type: 'klok',    fase: 'Retentie',   voorwaarde: 'trial_expires_at over ≤3d, event_booked = false, geactiveerd', timing: 'Wanneer minutesUntil(trial_expires_at) ≤ verloopt_3d_minuten', suppressie: 'Send-once, stop als event geboekt of venster al gepasseerd bij activatie' },
  { nummer: 17, naam: 'verloopt_1d',          label: 'Trial verloopt over 1 dag',         type: 'klok',    fase: 'Retentie',   voorwaarde: 'trial_expires_at over ≤1d, event_booked = false, geactiveerd', timing: 'Wanneer minutesUntil(trial_expires_at) ≤ verloopt_1d_minuten', suppressie: 'Send-once, stop als event geboekt of venster al gepasseerd bij activatie' },
  { nummer: 18, naam: 'verloopt_6u',          label: 'Trial verloopt over 6 uur',         type: 'klok',    fase: 'Retentie',   voorwaarde: 'trial_expires_at over ≤6u, event_booked = false, geactiveerd', timing: 'Wanneer minutesUntil(trial_expires_at) ≤ verloopt_6u_minuten', suppressie: 'Send-once, stop als event geboekt of venster al gepasseerd bij activatie' },
]

// ── Time helpers ─────────────────────────────────────────────

function minutesSince(date: string | null): number {
  if (!date) return -Infinity
  return (Date.now() - new Date(date).getTime()) / 60000
}

function minutesUntil(date: string | null): number {
  if (!date) return Infinity
  return (new Date(date).getTime() - Date.now()) / 60000
}

// ── Core: attempt to fire one workflow for one user ──────────
//
// Strict volgorde (regels 3 + 4):
//   (a) INSERT into demo_invest_trigger_sent — faalt atomisch als al aanwezig
//   (b) Verse herlezing van user/funnel/progress uit Supabase (regel 1 + 2)
//   (c) Volledige voorwaardecheck op verse data — onderdrukt als niet voldaan
//   (d) Webhook afvuren
//   (e) Resultaat loggen in demo_invest_trigger_log (regel 6)

async function attemptFire(
  supabase: SupabaseClient,
  userId: string,
  workflow: WorkflowDef,
  configMap: Map<string, DemoWebhookConfig>,
  thresholds: Map<string, number>,
  coreVideoIds: string[],
): Promise<'triggered' | 'suppressed' | 'already_sent'> {

  // ── Stap (a): Databasegrendel ────────────────────────────
  // Probeer de "verstuurd"-markering te reserveren. Als de UNIQUE constraint
  // faalt, is deze workflow al verstuurd voor deze gebruiker — stop direct.
  const { error: lockError } = await supabase
    .from('demo_invest_trigger_sent')
    .insert({ user_id: userId, workflow_naam: workflow.naam })

  if (lockError) {
    // Duplicate key = al verstuurd. Niets loggen, gewoon stoppen.
    return 'already_sent'
  }

  // ── Stap (b): Verse herlezing ────────────────────────────
  const [
    { data: freshUser },
    { data: freshFunnelRows },
    { data: freshProgressRows },
    { data: freshBookingRows },
    { data: freshEventsRows },
    { data: followUpDisabled },
  ] = await Promise.all([
    supabase.from('demo_invest_users').select('*').eq('id', userId).single(),
    supabase.from('demo_invest_user_funnel').select('*').eq('user_id', userId).limit(1),
    supabase.from('demo_invest_video_progress').select('*').eq('user_id', userId),
    supabase.from('demo_invest_event_bookings').select('*').eq('user_id', userId).eq('status', 'booked'),
    supabase.from('demo_invest_events').select('*'),
    supabase.from('demo_invest_trigger_sent').select('id').eq('user_id', userId).eq('workflow_naam', '__automatische_opvolging_uit__').maybeSingle(),
  ])

  const user = freshUser as DemoUser | null
  if (!user) {
    await logDecision(supabase, userId, '', workflow, 'onderdrukt', 'gebruiker niet gevonden', null, {})
    return 'suppressed'
  }

  if (followUpDisabled) {
    await supabase
      .from('demo_invest_trigger_sent')
      .delete()
      .eq('user_id', userId)
      .eq('workflow_naam', workflow.naam)

    await logDecision(supabase, userId, user.email, workflow, 'onderdrukt', 'automatische opvolging uitgeschakeld', null, {})
    return 'suppressed'
  }

  const funnel = (freshFunnelRows?.[0] ?? null) as DemoUserFunnel | null
  const progress = (freshProgressRows ?? []) as DemoVideoProgress[]
  const progressByVideoId = new Map(progress.map(p => [p.video_id, p]))
  const hasStartedAny = progress.some(p => p.status !== 'not_started')
  const bookedEventIds = (freshBookingRows ?? []).map((b: { event_id: string }) => b.event_id)
  const events = (freshEventsRows ?? []) as Array<{ id: string; starts_at: string }>

  // ── Stap (c): Volledige voorwaardecheck op verse data ────
  const t2u    = thresholds.get('activatie_2u_minuten')      ?? 120
  const t24u   = thresholds.get('activatie_24u_minuten')     ?? 1440
  const t72u   = thresholds.get('activatie_72u_minuten')     ?? 4320
  const t4d    = thresholds.get('dag4_minuten')              ?? 5760
  const t1w    = thresholds.get('workshop_nudge_w1_minuten') ?? 10080
  // Trial-verloop reminders — instelbaar via demo_invest_config voor testdoeleinden
  const t5d    = thresholds.get('verloopt_5d_minuten')       ?? 7200   // 5 dagen
  const t3d    = thresholds.get('verloopt_3d_minuten')       ?? 4320   // 3 dagen
  const t1d    = thresholds.get('verloopt_1d_minuten')       ?? 1440   // 1 dag
  const t6u    = thresholds.get('verloopt_6u_minuten')       ?? 360    // 6 uur

  let conditionMet = false
  let suppressReden = 'voorwaarde niet voldaan'
  let extraPayload: Record<string, unknown> = {}

  switch (workflow.naam) {
    case 'welkom':
      conditionMet = !!user.activated_at
      suppressReden = 'gebruiker niet geactiveerd'
      break

    case 'activatie_2u':
      // Alleen zolang nog NIET geactiveerd — meten vanaf created_at
      if (user.activated_at) {
        conditionMet = false
        suppressReden = 'account inmiddels geactiveerd'
      } else {
        conditionMet = minutesSince(user.created_at) >= t2u
        suppressReden = 'drempel 2u na aanmaken nog niet bereikt'
      }
      break

    case 'activatie_24u':
      if (user.activated_at) {
        conditionMet = false
        suppressReden = 'account inmiddels geactiveerd'
      } else {
        conditionMet = minutesSince(user.created_at) >= t24u
        suppressReden = 'drempel 24u na aanmaken nog niet bereikt'
      }
      break

    case 'activatie_72u':
      if (user.activated_at) {
        conditionMet = false
        suppressReden = 'account inmiddels geactiveerd'
      } else {
        conditionMet = minutesSince(user.created_at) >= t72u
        suppressReden = 'drempel 72u na aanmaken nog niet bereikt'
      }
      break

    case 'video_2_herinnering':
    case 'video_3_herinnering':
    case 'video_4_herinnering':
    case 'video_5_herinnering':
    case 'video_6_herinnering': {
      // Verwacht video-index (1-based) uit naam
      const vidIdx = parseInt(workflow.naam.replace('video_', '').replace('_herinnering', ''), 10) - 1
      const thisVideoId = coreVideoIds[vidIdx] ?? null

      // Basisvereisten: geactiveerd + trial actief (all_completed_at null)
      if (!user.activated_at) {
        conditionMet = false
        suppressReden = 'gebruiker nog niet geactiveerd'
        break
      }
      if (funnel?.all_completed_at) {
        conditionMet = false
        suppressReden = 'alle kernvideo\'s al voltooid — video-track gestopt'
        break
      }

      // Bepaal de eerstvolgende ongeziene video (laagste order_no, status != completed)
      let firstUnseenId: string | null = null
      for (const vid of coreVideoIds) {
        const p = progressByVideoId.get(vid)
        if (!p || p.status !== 'completed') {
          firstUnseenId = vid
          break
        }
      }

      // Deze trigger mag alleen afgaan als zijn video de eerstvolgende ongeziene is
      if (!thisVideoId || thisVideoId !== firstUnseenId) {
        conditionMet = false
        suppressReden = thisVideoId
          ? `video ${vidIdx + 1} is niet de eerstvolgende ongeziene video`
          : 'video-id niet gevonden'
        break
      }

      // Inactiviteitsdrempel: minutesSince(last_activity_at) >= inactiviteit_minuten
      const tInact = thresholds.get('inactiviteit_minuten') ?? 1440
      const inactief = minutesSince(user.last_activity_at ?? user.activated_at)
      if (inactief < tInact) {
        conditionMet = false
        suppressReden = `gebruiker te recent actief (${Math.round(inactief)} min geleden, drempel ${tInact} min)`
        break
      }

      // Frequency cap: max 1 video-herinnering per 24u per gebruiker
      const videoTriggerNamen = [
        'video_2_herinnering','video_3_herinnering',
        'video_4_herinnering','video_5_herinnering','video_6_herinnering',
      ]
      const { data: recentLogs } = await supabase
        .from('demo_invest_trigger_log')
        .select('created_at, workflow_naam')
        .eq('user_id', userId)
        .eq('status', 'verstuurd')
        .in('workflow_naam', videoTriggerNamen)
        .order('created_at', { ascending: false })

      const logs = (recentLogs ?? []) as Array<{ created_at: string; workflow_naam: string }>

      // Totaal cap: max 5 video-herinneringen over hele trial
      const totalCap = thresholds.get('video_nudge_cap') ?? 5
      if (logs.length >= totalCap) {
        conditionMet = false
        suppressReden = `cap bereikt: ${logs.length} van max ${totalCap} video-herinneringen verstuurd`
        break
      }

      // Per-24u cap: is er al een video-herinnering verstuurd in de afgelopen 24u?
      const last24h = logs.find(l => minutesSince(l.created_at) < 1440)
      if (last24h) {
        conditionMet = false
        suppressReden = `cap bereikt: al een video-herinnering verstuurd in de afgelopen 24u (${last24h.workflow_naam})`
        break
      }

      conditionMet = true
      extraPayload = { video_id: thisVideoId, video_index: vidIdx + 1 }
      break
    }

    case 'alles_gezien_c1':
      conditionMet = !!funnel?.all_completed_at
      suppressReden = 'nog niet alle kernvideo\'s voltooid'
      if (funnel?.all_completed_at) extraPayload = { all_completed_at: funnel.all_completed_at }
      break

    case 'dag4_inactief':
      conditionMet = !!funnel?.all_completed_at
        && !funnel.event_booked
        && minutesSince(funnel.all_completed_at) >= t4d
      suppressReden = funnel?.event_booked ? 'event al geboekt'
        : !funnel?.all_completed_at ? 'nog niet alle video\'s voltooid'
        : 'dag 4 drempel nog niet bereikt'
      break

    case 'workshop_1w_voor': {
      const bookedEvent = events.find(e => bookedEventIds.includes(e.id) && minutesUntil(e.starts_at) >= 0 && minutesUntil(e.starts_at) <= t1w)
      conditionMet = !!bookedEvent
      suppressReden = !funnel?.event_booked ? 'geen actieve boeking'
        : !bookedEvent ? 'event niet binnen 1 week of al geweest'
        : 'drempel niet bereikt'
      if (bookedEvent) extraPayload = { event_id: bookedEvent.id, event_starts_at: bookedEvent.starts_at }
      break
    }

    case 'workshop_bevestiging':
      conditionMet = !!funnel?.event_booked && !!funnel.event_booked_at
      suppressReden = 'geen actieve boeking gevonden'
      if (funnel?.event_booked_at) extraPayload = { event_booked_at: funnel.event_booked_at }
      break

    case 'trial_verlopen':
      conditionMet = !!user.trial_expires_at
        && minutesSince(user.trial_expires_at) >= 0
        && !funnel?.event_booked
      suppressReden = funnel?.event_booked ? 'event al geboekt'
        : !user.trial_expires_at ? 'geen trial_expires_at'
        : 'trial nog niet verlopen'
      break

    // ── Trial verloopreminders (mail_16–19) ──────────────────────
    //
    // Elke reminder vuurt ALLEEN als:
    //  1. Trial nog niet verlopen (minutesUntil >= 0)
    //  2. We binnen het juiste venster zitten (minutesUntil <= drempel)
    //  3. Gebruiker geactiveerd is (activated_at gezet)
    //  4. Geen event geboekt (dan is verval-druk niet meer nodig)
    //  5. Het venster niet al gepasseerd was op het moment van activatie:
    //     als minutesUntil(trial_expires_at) al kleiner is dan de drempel
    //     terwijl de gebruiker net activeerde, was dit moment al voorbij —
    //     de grendel (send-once) zorgt dat hij overgeslagen wordt zodra
    //     activated_at > (trial_expires_at - drempel). Dit is de check:
    //     activated_at < trial_expires_at - drempel (activatie was vóór het venster)
    //     Als activated_at LATER was dan (trial_expires_at - drempel) is het
    //     venster al voorbij bij activatie → conditionMet = false → overgeslagen.

    case 'verloopt_5d': {
      const mUntil = minutesUntil(user.trial_expires_at)
      const activatedBeforeWindow = !user.activated_at || !user.trial_expires_at
        ? false
        : new Date(user.activated_at).getTime() <= new Date(user.trial_expires_at).getTime() - t5d * 60000
      conditionMet = !!user.trial_expires_at
        && !!user.activated_at
        && !funnel?.event_booked
        && mUntil >= 0          // trial nog niet verlopen
        && mUntil <= t5d        // we zitten in het 5d-venster
        && activatedBeforeWindow // venster was nog NIET gepasseerd bij activatie
      suppressReden = !user.activated_at ? 'gebruiker niet geactiveerd'
        : funnel?.event_booked ? 'event al geboekt — verloopreminder onderdrukt'
        : !user.trial_expires_at ? 'geen trial_expires_at'
        : mUntil < 0 ? 'trial al verlopen'
        : mUntil > t5d ? '5d-venster nog niet bereikt'
        : !activatedBeforeWindow ? '5d-venster was al gepasseerd bij activatie — overgeslagen'
        : 'onbekend'
      if (conditionMet) extraPayload = { minutes_until_expiry: Math.round(mUntil), venster: '5d' }
      break
    }

    case 'verloopt_3d': {
      const mUntil = minutesUntil(user.trial_expires_at)
      const activatedBeforeWindow = !user.activated_at || !user.trial_expires_at
        ? false
        : new Date(user.activated_at).getTime() <= new Date(user.trial_expires_at).getTime() - t3d * 60000
      conditionMet = !!user.trial_expires_at
        && !!user.activated_at
        && !funnel?.event_booked
        && mUntil >= 0
        && mUntil <= t3d
        && activatedBeforeWindow
      suppressReden = !user.activated_at ? 'gebruiker niet geactiveerd'
        : funnel?.event_booked ? 'event al geboekt — verloopreminder onderdrukt'
        : !user.trial_expires_at ? 'geen trial_expires_at'
        : mUntil < 0 ? 'trial al verlopen'
        : mUntil > t3d ? '3d-venster nog niet bereikt'
        : !activatedBeforeWindow ? '3d-venster was al gepasseerd bij activatie — overgeslagen'
        : 'onbekend'
      if (conditionMet) extraPayload = { minutes_until_expiry: Math.round(mUntil), venster: '3d' }
      break
    }

    case 'verloopt_1d': {
      const mUntil = minutesUntil(user.trial_expires_at)
      const activatedBeforeWindow = !user.activated_at || !user.trial_expires_at
        ? false
        : new Date(user.activated_at).getTime() <= new Date(user.trial_expires_at).getTime() - t1d * 60000
      conditionMet = !!user.trial_expires_at
        && !!user.activated_at
        && !funnel?.event_booked
        && mUntil >= 0
        && mUntil <= t1d
        && activatedBeforeWindow
      suppressReden = !user.activated_at ? 'gebruiker niet geactiveerd'
        : funnel?.event_booked ? 'event al geboekt — verloopreminder onderdrukt'
        : !user.trial_expires_at ? 'geen trial_expires_at'
        : mUntil < 0 ? 'trial al verlopen'
        : mUntil > t1d ? '1d-venster nog niet bereikt'
        : !activatedBeforeWindow ? '1d-venster was al gepasseerd bij activatie — overgeslagen'
        : 'onbekend'
      if (conditionMet) extraPayload = { minutes_until_expiry: Math.round(mUntil), venster: '1d' }
      break
    }

    case 'verloopt_6u': {
      const mUntil = minutesUntil(user.trial_expires_at)
      const activatedBeforeWindow = !user.activated_at || !user.trial_expires_at
        ? false
        : new Date(user.activated_at).getTime() <= new Date(user.trial_expires_at).getTime() - t6u * 60000
      conditionMet = !!user.trial_expires_at
        && !!user.activated_at
        && !funnel?.event_booked
        && mUntil >= 0
        && mUntil <= t6u
        && activatedBeforeWindow
      suppressReden = !user.activated_at ? 'gebruiker niet geactiveerd'
        : funnel?.event_booked ? 'event al geboekt — verloopreminder onderdrukt'
        : !user.trial_expires_at ? 'geen trial_expires_at'
        : mUntil < 0 ? 'trial al verlopen'
        : mUntil > t6u ? '6u-venster nog niet bereikt'
        : !activatedBeforeWindow ? '6u-venster was al gepasseerd bij activatie — overgeslagen'
        : 'onbekend'
      if (conditionMet) extraPayload = { minutes_until_expiry: Math.round(mUntil), venster: '6u' }
      break
    }

    default:
      suppressReden = 'onbekende workflow'
  }

  // Voorwaarde niet voldaan — verwijder de grendel en log als onderdrukt
  if (!conditionMet) {
    await supabase
      .from('demo_invest_trigger_sent')
      .delete()
      .eq('user_id', userId)
      .eq('workflow_naam', workflow.naam)

    await logDecision(supabase, userId, user.email, workflow, 'onderdrukt', suppressReden, null, extraPayload)
    return 'suppressed'
  }

  // ── Stap (d): Webhook afvuren ────────────────────────────
  //
  // Eén centrale HubSpot-webhook-URL voor alle 15 triggers.
  // Per trigger sturen we exact: { workflow: "<code>", email, naam }
  // De "workflow"-code vertelt HubSpot welke mailflow moet starten.

  // Haal de centrale webhook-URL op: eerst env var, dan __central__ config-rij
  const centralCfg = configMap.get('__central__')
  const centralUrl = process.env.HUBSPOT_WEBHOOK_URL?.trim()
    ?? centralCfg?.webhook_url?.trim()
    ?? ''

  // Per-workflow actief-vlag blijft werken voor handmatig uitschakelen
  const cfg = configMap.get(workflow.naam)
  const isActive = cfg?.actief ?? true

  let status: TriggerStatus = 'verstuurd'
  let responseStatus: string | null = null
  let logReden: string | null = null

  if (!isActive) {
    status = 'onderdrukt'
    logReden = 'workflow uitgeschakeld'
    await supabase
      .from('demo_invest_trigger_sent')
      .delete()
      .eq('user_id', userId)
      .eq('workflow_naam', workflow.naam)
  } else if (!centralUrl) {
    status = 'no_endpoint'
    logReden = 'geen centrale webhook URL geconfigureerd (HUBSPOT_WEBHOOK_URL of __central__ rij)'
    await supabase
      .from('demo_invest_trigger_sent')
      .delete()
      .eq('user_id', userId)
      .eq('workflow_naam', workflow.naam)
  } else {
  const hubspotCode = HUBSPOT_CODE[workflow.naam] ?? workflow.naam
  const callState = await getCallUserState(supabase, user.id)
  const booking = await resolveBookingLink(supabase, callState.contact_owner_email)
  const outboundBody = JSON.stringify({
  workflow: hubspotCode,
  email:    user.email,
  naam:     user.name ?? '',
  contact_owner_email: callState.contact_owner_email,
  appointment_url: booking?.booking_url ?? null,
  appointment_owner_name: booking?.owner_name ?? null,
  appointment_link_is_fallback: booking?.is_fallback ?? null,
  })
    try {
      const res = await fetch(centralUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    outboundBody,
        signal:  AbortSignal.timeout(8000),
      })
      responseStatus = String(res.status)
      status = res.ok ? 'verstuurd' : 'gefaald'
      if (!res.ok) {
        logReden = `HTTP ${res.status}`
        await supabase
          .from('demo_invest_trigger_sent')
          .delete()
          .eq('user_id', userId)
          .eq('workflow_naam', workflow.naam)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      responseStatus = `fetch_error: ${msg}`
      status = 'gefaald'
      logReden = msg
      await supabase
        .from('demo_invest_trigger_sent')
        .delete()
        .eq('user_id', userId)
        .eq('workflow_naam', workflow.naam)
    }
  }

  // payload used only for logging
  const payload: Record<string, unknown> = {
    workflow_nummer: workflow.nummer,
    workflow_naam:   workflow.naam,
    hubspot_code:    HUBSPOT_CODE[workflow.naam] ?? workflow.naam,
    contact_email:   user.email,
    naam:            user.name ?? '',
    timestamp:       new Date().toISOString(),
    ...extraPayload,
  }

  // ── Stap (e): Log het resultaat ──────────────────────────
  await logDecision(supabase, userId, user.email, workflow, status, logReden, responseStatus, payload)

  return status === 'verstuurd' ? 'triggered' : 'suppressed'
}

// ── Log helper ───────────────────────────────────────────────

async function logDecision(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  workflow: WorkflowDef,
  status: TriggerStatus,
  reden: string | null,
  responseStatus: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await supabase.from('demo_invest_trigger_log').insert({
    user_id:         userId,
    contact_email:   email,
    workflow_nummer: workflow.nummer,
    workflow_naam:   workflow.naam,
    status,
    reden,
    payload_json:    payload,
    response_status: responseStatus,
  })
}

// ── Public: instant trigger (from API routes) ────────────────
//
// Gebruikt exact dezelfde attemptFire — dezelfde grendel en verse herlezing.
// De caller hoeft geen firedNamen meer bij te houden; de database grendelt.

export async function fireInstant(
  supabase: SupabaseClient,
  workflowNaam: string,
  user: DemoUser,
  _firedNamen: Set<string>, // behouden voor backwards-compat, niet meer gebruikt
  _extraPayload: Record<string, unknown> = {},
): Promise<void> {
  const workflow = WORKFLOWS.find(w => w.naam === workflowNaam)
  if (!workflow) return

  const [{ data: configRows }, { data: cfgValues }, { data: videosData }] = await Promise.all([
    supabase.from('demo_invest_webhook_config').select('*'),
    supabase.from('demo_invest_config').select('*'),
    supabase.from('demo_invest_videos').select('id, order_no').eq('section', 'core').order('order_no'),
  ])

  const configMap = new Map<string, DemoWebhookConfig>(
    (configRows ?? []).map((r: DemoWebhookConfig) => [r.trigger_naam, r])
  )
  const thresholds = new Map<string, number>(
    (cfgValues ?? []).map((r: DemoConfig) => [r.sleutel, Number(r.waarde)])
  )
  const coreVideoIds = (videosData ?? []).map((v: { id: string }) => v.id)

  await attemptFire(supabase, user.id, workflow, configMap, thresholds, coreVideoIds)
}

// ── Public: clock evaluator (called by cron) ─────────────────

export async function runEvaluator(
  supabase: SupabaseClient,
): Promise<{ usersProcessed: number; triggered: number; suppressed: number }> {

  // Laad config — eenmalig voor de hele evaluator-run
  const [{ data: configRows }, { data: cfgValues }, { data: videosData }] = await Promise.all([
    supabase.from('demo_invest_webhook_config').select('*'),
    supabase.from('demo_invest_config').select('*'),
    supabase.from('demo_invest_videos').select('id, order_no').eq('section', 'core').order('order_no'),
  ])

  const configMap = new Map<string, DemoWebhookConfig>(
    (configRows ?? []).map((r: DemoWebhookConfig) => [r.trigger_naam, r])
  )
  const thresholds = new Map<string, number>(
    (cfgValues ?? []).map((r: DemoConfig) => [r.sleutel, Number(r.waarde)])
  )
  const coreVideoIds = (videosData ?? []).map((v: { id: string }) => v.id)

  // Laad ALLE gebruikers — zowel geactiveerd (video/conversie workflows)
  // als niet-geactiveerd (W2/W3/W4 activatie-reminders).
  // Elke workflow checkt zelf in stap (c) of de gebruiker in de juiste staat zit.
  const { data: usersData } = await supabase
    .from('demo_invest_users')
    .select('id')

  const users = (usersData ?? []) as Array<{ id: string }>
  if (users.length === 0) return { usersProcessed: 0, triggered: 0, suppressed: 0 }

  // De klok-workflows die de evaluator beoordeelt (instant = enkel via API routes)
  const clockWorkflows = WORKFLOWS.filter(w => w.type === 'klok')

  let triggered = 0
  let suppressed = 0

  // Per gebruiker: probeer elke klok-workflow via attemptFire.
  // attemptFire doet verse herlezing + databasegrendel per poging.
  for (const { id: userId } of users) {
    for (const workflow of clockWorkflows) {
      const result = await attemptFire(supabase, userId, workflow, configMap, thresholds, coreVideoIds)
      if (result === 'triggered') triggered++
      else if (result === 'suppressed') suppressed++
      // 'already_sent' telt niet mee
    }
  }

  return { usersProcessed: users.length, triggered, suppressed }
}
