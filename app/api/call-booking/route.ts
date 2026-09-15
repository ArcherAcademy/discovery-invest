import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import {
  getCallUserState,
  normalizeCallBookingPayload,
  recordCallBooking,
  resolveBookingLink,
  updateCallUserState,
  type CallBookingInput,
} from '@/lib/call-booking-data'
import { createAdminClient } from '@/lib/supabase/admin'

const HUBSPOT_MEETING_HOST = /^meetings(?:-[a-z0-9]+)?\.hubspot\.com$/i

function isValidHubSpotMeetingUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && HUBSPOT_MEETING_HOST.test(url.hostname)
  } catch {
    return false
  }
}

async function getAvailableBooking(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createAdminClient()
  const [{ data: coreVideos, error: videosError }, { data: completedProgress, error: progressError }] = await Promise.all([
    supabase.from('demo_invest_videos').select('id').eq('section', 'core'),
    supabase
      .from('demo_invest_video_progress')
      .select('video_id')
      .eq('user_id', user.id)
      .eq('status', 'completed'),
  ])

  if (videosError) throw videosError
  if (progressError) throw progressError

  const coreVideoIds = new Set((coreVideos ?? []).map(video => video.id))
  const completedCoreCount = new Set(
    (completedProgress ?? []).map(progress => progress.video_id).filter(videoId => coreVideoIds.has(videoId)),
  ).size
  if (completedCoreCount < 6) {
    return { error: NextResponse.json({ available: false }, { status: 403 }) }
  }

  const callState = await getCallUserState(supabase, user.id)
  const booking = await resolveBookingLink(supabase, callState.contact_owner_email)
  if (!booking || !isValidHubSpotMeetingUrl(booking.booking_url)) {
    return { error: NextResponse.json({ available: false }, { status: 404 }) }
  }

  return { user, supabase, callState, booking }
}

export async function GET(req: NextRequest) {
  const result = await getAvailableBooking(req)
  if ('error' in result) return result.error

  return NextResponse.json({ available: true, ...result.booking })
}

export async function POST(req: NextRequest) {
  const result = await getAvailableBooking(req)
  if ('error' in result) return result.error

  const body = await req.json().catch(() => null) as { action?: unknown; booking?: CallBookingInput } | null
  if (body?.action !== 'opened' && body?.action !== 'booked') {
    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
  }

  const now = new Date().toISOString()
  if (body.action === 'opened') {
    const state = await updateCallUserState(result.supabase, result.user.id, {
      call_opened_at: result.callState.call_opened_at ?? now,
      call_clicked_at: result.callState.call_clicked_at ?? now,
    })
    return NextResponse.json({ ok: true, call_booked: state.call_booked, call_booked_at: state.call_booked_at })
  }

  const payload = normalizeCallBookingPayload(result.user.id, body.booking ?? null, result.booking)
  await recordCallBooking(result.supabase, result.user.id, payload)
  const state = result.callState.call_booked
    ? result.callState
    : await updateCallUserState(result.supabase, result.user.id, {
        call_booked: true,
        call_booked_at: now,
      })

  return NextResponse.json({ ok: true, call_booked: state.call_booked, call_booked_at: state.call_booked_at })
}
