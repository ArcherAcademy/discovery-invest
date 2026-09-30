import type { SupabaseClient } from '@supabase/supabase-js'
import { WORKFLOWS, attemptFire } from '@/lib/workflow-engine'
import { advanceHubSpotLeadStage } from '@/lib/hubspot-lead-stage'
import type { DemoUser } from '@/lib/types'

const ACTIVATION_WORKFLOWS = ['activatie_2u', 'activatie_24u', 'activatie_72u']
const VIDEO_WORKFLOWS = [2, 3, 4, 5, 6].map(index => `video_${index}_herinnering`)
const CONVERSION_WORKFLOWS = ['plaats_ligt_klaar', 'laatste_dag']
const EXPIRY_WORKFLOWS = ['trial_verlopen', 'verloopt_5d', 'verloopt_3d', 'verloopt_1d', 'verloopt_6u']
const STAGE_WORKFLOWS = ['lead_stage_6of6_fallback', 'lead_stage_waitlist_discovery']
const SCHEDULED_EVALUATOR_CONCURRENCY = 10
const SCHEDULED_EVALUATOR_LIMIT = 50

type ScheduledMessage = {
  id: string
  lead_id: string
  workflow: string
  condition_key: string
  claim_token: string
}

type ConfigRow = { sleutel: string; waarde: string }

function minutes(value: string | number | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function getScheduleConfig(supabase: SupabaseClient) {
  const { data } = await supabase.from('demo_invest_config').select('sleutel, waarde')
  return new Map((data ?? []).map((row: ConfigRow) => [row.sleutel, minutes(row.waarde, 0)]))
}

export async function scheduleLeadTimeline(supabase: SupabaseClient, user: DemoUser) {
  const config = await getScheduleConfig(supabase)
  const createdAt = new Date(user.created_at).getTime()
  const activation = (key: string, fallback: number) => new Date(createdAt + minutes(config.get(key), fallback) * 60_000).toISOString()
  const messages = ACTIVATION_WORKFLOWS.map((workflow, index) => ({
    workflow,
    scheduled_for: activation(`activatie_${[2, 24, 72][index]}u_minuten`, [120, 1440, 4320][index]),
    condition_key: 'not_activated',
  }))

  const phaseOneFollowUps = [
    ['opvolg_24u', 'opvolg_24u_minuten', 1440],
    ['opvolg_3d', 'opvolg_3d_minuten', 4320],
    ['opvolg_5d', 'opvolg_5d_minuten', 7200],
  ] as const
  for (const [workflow, key, fallback] of phaseOneFollowUps) {
    messages.push({ workflow, scheduled_for: activation(key, fallback), condition_key: 'not_activated' })
  }

  if (user.activated_at) {
    const expiry = user.trial_expires_at ? new Date(user.trial_expires_at).getTime() : null
    const addExpiry = (workflow: string, offsetMinutes: number, condition_key: string) => {
      if (expiry) messages.push({ workflow, scheduled_for: new Date(expiry - offsetMinutes * 60_000).toISOString(), condition_key })
    }
    if (expiry) {
      addExpiry('trial_verlopen', 0, 'expired_not_booked')
      addExpiry('verloopt_5d', minutes(config.get('verloopt_5d_minuten'), 7200), 'activated_not_booked')
      addExpiry('verloopt_3d', minutes(config.get('verloopt_3d_minuten'), 4320), 'activated_not_booked')
      addExpiry('verloopt_1d', minutes(config.get('verloopt_1d_minuten'), 1440), 'activated_not_booked')
      addExpiry('verloopt_6u', minutes(config.get('verloopt_6u_minuten'), 360), 'activated_not_booked')
    }
    const { data: progress } = await supabase.from('demo_invest_video_progress').select('video_id').eq('user_id', user.id).eq('status', 'completed')
    const { data: videos } = await supabase.from('demo_invest_videos').select('id, order_no').eq('section', 'core').order('order_no')
    const completed = new Set((progress ?? []).map(row => row.video_id))
    const next = (videos ?? []).find(video => video.order_no >= 2 && !completed.has(video.id))
    if (next) {
      const activity = new Date(user.last_activity_at ?? user.activated_at).getTime()
      messages.push({
        workflow: `video_${next.order_no}_herinnering`,
        scheduled_for: new Date(activity + minutes(config.get('inactiviteit_minuten'), 1440) * 60_000).toISOString(),
        condition_key: 'next_unseen_video',
      })
    }
  }

  const { error } = await supabase.rpc('demo_invest_schedule_messages', { p_lead_id: user.id, p_messages: messages })
  if (error) throw new Error(`Tijdlijn plannen mislukt: ${error.message}`)
  return messages.length
}

export async function cancelScheduledWorkflows(supabase: SupabaseClient, leadId: string, workflows: string[]) {
  if (!workflows.length) return
  const { error } = await supabase.from('demo_invest_scheduled_messages').update({ status: 'cancelled' }).eq('lead_id', leadId).eq('status', 'pending').in('workflow', workflows)
  if (error) throw new Error(`Tijdlijn annuleren mislukt: ${error.message}`)
}

export async function cancelActivationMessages(supabase: SupabaseClient, leadId: string) {
  await cancelScheduledWorkflows(supabase, leadId, [...ACTIVATION_WORKFLOWS, 'opvolg_24u', 'opvolg_3d', 'opvolg_5d'])
}

export async function cancelVideoMessages(supabase: SupabaseClient, leadId: string) {
  await cancelScheduledWorkflows(supabase, leadId, VIDEO_WORKFLOWS)
}

export async function cancelBookingMessages(supabase: SupabaseClient, leadId: string) {
  await cancelScheduledWorkflows(supabase, leadId, [...CONVERSION_WORKFLOWS, ...EXPIRY_WORKFLOWS])
}

function atBrusselsHour(date: Date, hour: number): Date {
  const result = new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(result).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value
    return acc
  }, {})
  const target = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, 0, 0)
  const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return new Date(result.getTime() + target - observed)
}

export async function scheduleSixOfSixFollowUps(supabase: SupabaseClient, leadId: string, allCompletedAt: string) {
  const completed = new Date(allCompletedAt)
  const inTwoDays = new Date(completed.getTime() + 48 * 60 * 60 * 1000)
  const daySeven = new Date(completed.getTime() + 7 * 24 * 60 * 60 * 1000)
  const messages = [
    { workflow: 'plaats_ligt_klaar', scheduled_for: inTwoDays.toISOString(), condition_key: 'completed_not_booked' },
    { workflow: 'laatste_dag', scheduled_for: atBrusselsHour(daySeven, 16).toISOString(), condition_key: 'completed_not_booked' },
  ]
  const { error } = await supabase.rpc('demo_invest_schedule_messages', { p_lead_id: leadId, p_messages: messages })
  if (error) throw new Error(`6/6-opvolging plannen mislukt: ${error.message}`)
}

export async function scheduleSixOfSixFallback(supabase: SupabaseClient, leadId: string) {
  const scheduledFor = new Date(Date.now() + 5 * 60_000).toISOString()
  const { error } = await supabase.rpc('demo_invest_schedule_messages', {
    p_lead_id: leadId,
    p_messages: [{ workflow: 'lead_stage_6of6_fallback', scheduled_for: scheduledFor, condition_key: 'six_core_videos_without_edition_form' }],
  })
  if (error) throw new Error(`6/6 stage fallback plannen mislukt: ${error.message}`)
}

export async function scheduleWaitlistDiscoveryStage(supabase: SupabaseClient, leadId: string) {
  await cancelScheduledWorkflows(supabase, leadId, ['lead_stage_6of6_fallback'])
  const scheduledFor = new Date(Date.now() + 2 * 60_000).toISOString()
  const { error } = await supabase.rpc('demo_invest_schedule_messages', {
    p_lead_id: leadId,
    p_messages: [{ workflow: 'lead_stage_waitlist_discovery', scheduled_for: scheduledFor, condition_key: 'edition_form_submitted' }],
  })
  if (error) throw new Error(`Waitlist stage plannen mislukt: ${error.message}`)
}

export interface ScheduledEvaluatorResult {
  claimed: number
  sent: number
  skipped: number
  failed: number
}

export async function runScheduledEvaluator(supabase: SupabaseClient, limit = SCHEDULED_EVALUATOR_LIMIT): Promise<ScheduledEvaluatorResult> {
  const { data: rows, error } = await supabase.rpc('demo_invest_claim_scheduled_messages', { p_now: new Date().toISOString(), p_limit: limit, p_claim_ttl_seconds: 900 })
  if (error) throw new Error(`Due-berichten claimen mislukt: ${error.message}`)
  const [{ data: configRows }, { data: cfgValues }, { data: videosData }] = await Promise.all([
    supabase.from('demo_invest_webhook_config').select('*'),
    supabase.from('demo_invest_config').select('*'),
    supabase.from('demo_invest_videos').select('id, order_no').eq('section', 'core').order('order_no'),
  ])
  const configMap = new Map((configRows ?? []).map((row: any) => [row.trigger_naam, row]))
  const thresholds = new Map((cfgValues ?? []).map((row: ConfigRow) => [row.sleutel, minutes(row.waarde, 0)]))
  const coreVideoIds = (videosData ?? []).map((video: { id: string }) => video.id)
  const claimedRows = (rows ?? []) as ScheduledMessage[]
  const result = { claimed: claimedRows.length, sent: 0, skipped: 0, failed: 0 }

  async function registerFailure(row: ScheduledMessage, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    console.error('[scheduled-evaluator] gepland bericht mislukt:', { id: row.id, workflow: row.workflow, error: message })
    const { error: releaseError } = await supabase.rpc('demo_invest_release_scheduled_message', {
      p_id: row.id,
      p_claim_token: row.claim_token,
    })
    if (releaseError) console.error('[scheduled-evaluator] claim vrijgeven mislukt:', releaseError)
    return 'failed' as const
  }

  async function processMessage(row: ScheduledMessage): Promise<'sent' | 'skipped' | 'failed'> {
    try {
      if (STAGE_WORKFLOWS.includes(row.workflow)) {
        const { data: user, error: userError } = await supabase
          .from('demo_invest_users')
          .select('email')
          .eq('id', row.lead_id)
          .single()
        if (userError || !user?.email) throw new Error(userError?.message ?? 'Discovery-gebruiker of e-mailadres niet gevonden')

        const trigger = row.workflow === 'lead_stage_6of6_fallback' ? 'six_core_videos' : 'edition_selected'
        const stageResult = await advanceHubSpotLeadStage(user.email, trigger)
        const finalStatus = stageResult.updated || stageResult.reason === 'already_at_or_beyond_target' ? 'sent' : 'skipped'
        const { error: updateError } = await supabase
          .from('demo_invest_scheduled_messages')
          .update({ status: finalStatus, sent_at: new Date().toISOString(), claim_token: null, claim_until: null })
          .eq('id', row.id)
          .eq('claim_token', row.claim_token)
        if (updateError) throw updateError
        return stageResult.updated ? 'sent' : 'skipped'
      }

      const workflow = WORKFLOWS.find(item => item.naam === row.workflow)
      if (!workflow) {
        const { error: updateError } = await supabase
          .from('demo_invest_scheduled_messages')
          .update({ status: 'skipped', claim_token: null, claim_until: null })
          .eq('id', row.id)
          .eq('claim_token', row.claim_token)
        if (updateError) throw updateError
        return 'skipped'
      }

      const fired = await attemptFire(supabase, row.lead_id, workflow, configMap, thresholds, coreVideoIds)
      if (fired === 'triggered' || fired === 'already_sent') {
        const { error: updateError } = await supabase
          .from('demo_invest_scheduled_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString(), claim_token: null, claim_until: null })
          .eq('id', row.id)
          .eq('claim_token', row.claim_token)
        if (updateError) throw updateError
        return 'sent'
      }
      if (fired === 'suppressed') {
        const { error: updateError } = await supabase
          .from('demo_invest_scheduled_messages')
          .update({ status: 'skipped', claim_token: null, claim_until: null })
          .eq('id', row.id)
          .eq('claim_token', row.claim_token)
        if (updateError) throw updateError
        return 'skipped'
      }
      return registerFailure(row, `Workflow ${row.workflow} kon niet worden verstuurd`)
    } catch (error) {
      return registerFailure(row, error)
    }
  }

  for (let start = 0; start < claimedRows.length; start += SCHEDULED_EVALUATOR_CONCURRENCY) {
    const outcomes = await Promise.all(claimedRows.slice(start, start + SCHEDULED_EVALUATOR_CONCURRENCY).map(processMessage))
    for (const outcome of outcomes) result[outcome] += 1
  }

  return result
}
