import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ACTIONS = new Set(['opened', 'closed', 'submitted'])
const ALLOWED_SOURCES = new Set(['header', 'sidebar', 'video_completion', 'video_rewatch'])

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    action?: string
    source?: string
    videoId?: string | null
  } | null

  if (!body?.action || !ALLOWED_ACTIONS.has(body.action) || !body.source || !ALLOWED_SOURCES.has(body.source)) {
    return NextResponse.json({ error: 'invalid_tracking_event' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { error: logError } = await supabase
    .from('demo_invest_webhook_log')
    .insert({
      user_id: user.id,
      event_type: `invest_avond.popup_${body.action}`,
      payload_json: {
        event: `invest_avond.popup_${body.action}`,
        user_id: user.id,
        timestamp: now,
        source: body.source,
        video_id: body.videoId ?? null,
      },
      response_status: 'tracked_in_app',
    })

  if (logError) {
    console.error('[invest-avond/track] popup-event opslaan mislukt:', logError)
    return NextResponse.json({ error: 'tracking_failed' }, { status: 500 })
  }

  if (body.action === 'opened') {
    const { error: funnelError } = await supabase
      .from('demo_invest_user_funnel')
      .upsert({
        user_id: user.id,
        invest_avond_verschenen: true,
        updated_at: now,
      }, { onConflict: 'user_id' })

    if (funnelError) {
      console.error('[invest-avond/track] verschenen-status opslaan mislukt:', funnelError)
      return NextResponse.json({ error: 'funnel_tracking_failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
