import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const USER_COLUMNS = 'id,email,last_activity_at,whatsapp_opt_in'
const FUNNEL_COLUMNS = 'user_id,videos_completed_count,all_completed_at,invest_avond_geclaimd'
const VIDEO_COLUMNS = 'id,order_no,section,title'
const PROGRESS_COLUMNS = 'user_id,video_id,progress_pct,status,started_at,completed_at,last_activity_at'
const BOOKING_COLUMNS = 'user_id,event_id,booked_at,status'
const EVENT_COLUMNS = 'id,starts_at,location,capacity,price_eur'
const TRIGGER_COLUMNS = 'user_id,workflow_naam,status,created_at'
const WEBHOOK_COLUMNS = 'user_id,event_type,created_at'

async function fetchLimited<T>(query: any, limit: number): Promise<T[]> {
  const { data, error } = await query.limit(limit)
  if (error) throw error
  return (data ?? []) as T[]
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrMentor(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const dateRange = (query: any, column: string) => {
    if (from) query = query.gte(column, `${from}T00:00:00.000Z`)
    if (to) { const end = new Date(`${to}T00:00:00.000Z`); end.setUTCDate(end.getUTCDate() + 1); query = query.lt(column, end.toISOString()) }
    return query
  }

  try {
    const [users, videos, progress, funnel, bookings, events, triggers, webhooks] = await Promise.all([
      fetchLimited(supabase.from('demo_invest_users').select(USER_COLUMNS).order('id'), 5000),
      fetchLimited(supabase.from('demo_invest_videos').select(VIDEO_COLUMNS).order('order_no'), 100),
      fetchLimited(dateRange(supabase.from('demo_invest_video_progress').select(PROGRESS_COLUMNS).order('started_at', { ascending: true }), 'started_at'), 10000),
      fetchLimited(supabase.from('demo_invest_user_funnel').select(FUNNEL_COLUMNS).order('user_id'), 5000),
      fetchLimited(dateRange(supabase.from('demo_invest_event_bookings').select(BOOKING_COLUMNS).order('booked_at', { ascending: false }), 'booked_at'), 5000),
      fetchLimited(supabase.from('demo_invest_events').select(EVENT_COLUMNS).order('starts_at'), 100),
      fetchLimited(dateRange(supabase.from('demo_invest_trigger_log').select(TRIGGER_COLUMNS).order('created_at', { ascending: false }), 'created_at'), 500),
      fetchLimited(dateRange(supabase.from('demo_invest_webhook_log').select(WEBHOOK_COLUMNS).eq('event_type', 'call.booked').order('created_at', { ascending: false }), 'created_at'), 5000),
    ])

    return NextResponse.json({ users, videos, progress, funnel, bookings, events, triggers, webhooks })
  } catch (error) {
    console.error('[analytics] data ophalen mislukt:', error)
    return NextResponse.json({ error: 'Analyticsgegevens konden niet worden opgehaald.' }, { status: 500 })
  }
}
