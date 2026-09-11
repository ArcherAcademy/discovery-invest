import { createClient } from './supabase/server'
import type { DemoUser, DemoUserFunnel, DemoVideo } from './types'

export type WebhookEventType =
  | 'trial.account_created'
  | 'trial.account_activated'
  | 'video.started'
  | 'video.progress'
  | 'video.completed'
  | 'videos.all_completed'
  | 'bonus.unlocked'
  | 'bonus.video_completed'
  | 'event.ticket_unlocked'
  | 'event.booked'
  | 'event.booking_cancelled'
  | 'trial.expired'

interface EmitEventOptions {
  type: WebhookEventType
  user: DemoUser
  funnel?: DemoUserFunnel | null
  nextVideo?: DemoVideo | null
  data?: Record<string, unknown>
}

export async function emitEvent(opts: EmitEventOptions): Promise<void> {
  const { type, user, funnel, nextVideo, data = {} } = opts
  const supabase = await createClient()

  const payload = {
    event: type,
    user_id: user.id,
    contact_email: user.email,
    locale: user.locale ?? 'nl',
    timestamp: new Date().toISOString(),
    whatsapp_opt_in: user.whatsapp_opt_in ?? false,
    videos_completed_count: funnel?.videos_completed_count ?? 0,
    next_unwatched_video: nextVideo
      ? { id: nextVideo.id, order_no: nextVideo.order_no, title: nextVideo.title }
      : null,
    all_completed_at: funnel?.all_completed_at ?? null,
    event_booked: funnel?.event_booked ?? false,
    trial_expires_at: user.trial_expires_at ?? null,
    data,
  }

  // Step 1 — always write to webhook_log first (fail-safe)
  let logId: string | null = null
  const { data: logRow } = await supabase
    .from('demo_invest_webhook_log')
    .insert({
      user_id: user.id,
      event_type: type,
      payload_json: payload,
      response_status: null,
    })
    .select('id')
    .single()

  logId = logRow?.id ?? null

  // Step 2 — try POSTing to webhook endpoint (completely fail-safe)
  const endpoint = process.env.WEBHOOK_ENDPOINT
  let responseStatus = 'no_endpoint'

  if (endpoint && endpoint.trim() !== '') {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      })
      responseStatus = String(res.status)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      responseStatus = `fetch_error: ${message}`
    }
  }

  // Update log row with delivery status
  if (logId) {
    await supabase
      .from('demo_invest_webhook_log')
      .update({ response_status: responseStatus })
      .eq('id', logId)
  }
}
