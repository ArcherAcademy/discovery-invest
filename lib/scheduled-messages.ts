import type { SupabaseClient } from '@supabase/supabase-js'
import { WORKFLOWS, attemptFire } from '@/lib/workflow-engine'
import type { DemoUser } from '@/lib/types'

const ACTIVATION_WORKFLOWS = ['activatie_2u', 'activatie_24u', 'activatie_72u']
const VIDEO_WORKFLOWS = [2, 3, 4, 5, 6].map(index => `video_${index}_herinnering`)
const EXPIRY_WORKFLOWS = ['dag4_inactief', 'trial_verlopen', 'verloopt_5d', 'verloopt_3d', 'verloopt_1d', 'verloopt_6u']

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

export async function scheduleLeadTimeline(supabase: SupabaseClient, user: DemoUser, now = new Date()) {
  const config = await getScheduleConfig(supabase)
  const createdAt = new Date(user.created_at).getTime()
  const activation = (key: string, fallback: number) => new Date(createdAt + minutes(config.get(key), fallback) * 60_000).toISOString()
  const messages = ACTIVATION_WORKFLOWS.map((workflow, index) => ({
    workflow,
    scheduled_for: activation(`activatie_${[2, 24, 72][index]}u_minuten`, [120, 1440, 4320][index]),
    condition_key: 'not_activated',
  }))

  if (user.activated_at) {
    const activatedAt = new Date(user.activated_at).getTime()
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
  await cancelScheduledWorkflows(supabase, leadId, ACTIVATION_WORKFLOWS)
}

export async function cancelVideoMessages(supabase: SupabaseClient, leadId: string) {
  await cancelScheduledWorkflows(supabase, leadId, VIDEO_WORKFLOWS)
}

export async function cancelBookingMessages(supabase: SupabaseClient, leadId: string) {
  await cancelScheduledWorkflows(supabase, leadId, ['dag4_inactief', ...EXPIRY_WORKFLOWS])
}

export interface ScheduledEvaluatorResult {
  claimed: number
  sent: number
  skipped: number
  failed: number
}

export async function runScheduledEvaluator(supabase: SupabaseClient, limit = 200): Promise<ScheduledEvaluatorResult> {
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
  const result = { claimed: (rows ?? []).length, sent: 0, skipped: 0, failed: 0 }

  for (const row of (rows ?? []) as ScheduledMessage[]) {
    const workflow = WORKFLOWS.find(item => item.naam === row.workflow)
    if (!workflow) {
      await supabase.from('demo_invest_scheduled_messages').update({ status: 'skipped', claim_token: null, claim_until: null }).eq('id', row.id).eq('claim_token', row.claim_token)
      result.skipped++
      continue
    }
    const fired = await attemptFire(supabase, row.lead_id, workflow, configMap, thresholds, coreVideoIds)
    if (fired === 'triggered' || fired === 'already_sent') {
      await supabase.from('demo_invest_scheduled_messages').update({ status: 'sent', sent_at: new Date().toISOString(), claim_token: null, claim_until: null }).eq('id', row.id).eq('claim_token', row.claim_token)
      result.sent++
    } else if (fired === 'suppressed') {
      await supabase.from('demo_invest_scheduled_messages').update({ status: 'skipped', claim_token: null, claim_until: null }).eq('id', row.id).eq('claim_token', row.claim_token)
      result.skipped++
    } else {
      await supabase.rpc('demo_invest_release_scheduled_message', { p_id: row.id, p_claim_token: row.claim_token })
      result.failed++
    }
  }
  return result
}
