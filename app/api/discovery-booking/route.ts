import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitEvent } from '@/lib/emit-event'
import type { DemoEvent, DemoEventBooking, DemoUser, DemoUserFunnel } from '@/lib/types'

async function getUserContext(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return null

  const supabase = createAdminClient()
  const [{ data: userData, error: userError }, { data: funnelData, error: funnelError }] = await Promise.all([
    supabase.from('demo_invest_users').select('*').eq('id', user.id).single(),
    supabase.from('demo_invest_user_funnel').select('*').eq('user_id', user.id).maybeSingle(),
  ])
  if (userError) throw userError
  if (funnelError) throw funnelError

  return {
    supabase,
    user: userData as DemoUser,
    funnel: funnelData as DemoUserFunnel | null,
  }
}

export async function GET(req: NextRequest) {
  const context = await getUserContext(req)
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: events, error } = await context.supabase
    .from('demo_invest_events')
    .select('id, title, starts_at, location, capacity, spots_left, price_eur, description')
    .gte('starts_at', new Date().toISOString())
    .gt('spots_left', 0)
    .order('starts_at', { ascending: true })
    .limit(3)
  if (error) return NextResponse.json({ error: 'events_unavailable' }, { status: 500 })

  const { data: booking } = await context.supabase
    .from('demo_invest_event_bookings')
    .select('id, user_id, event_id, booked_at, status')
    .eq('user_id', context.user.id)
    .eq('status', 'booked')
    .order('booked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ events: (events ?? []) as DemoEvent[], booking: booking as DemoEventBooking | null })
}

export async function POST(req: NextRequest) {
  const context = await getUserContext(req)
  if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { eventId?: unknown } | null
  if (typeof body?.eventId !== 'string' || !body.eventId) {
    return NextResponse.json({ error: 'event_required' }, { status: 400 })
  }

  const { data: existingBooking } = await context.supabase
    .from('demo_invest_event_bookings')
    .select('id, user_id, event_id, booked_at, status')
    .eq('user_id', context.user.id)
    .eq('status', 'booked')
    .maybeSingle()
  if (existingBooking) return NextResponse.json({ ok: true, booking: existingBooking, alreadyBooked: true })

  const { data: event, error: eventError } = await context.supabase
    .from('demo_invest_events')
    .select('id, title, starts_at, location, capacity, spots_left, price_eur, description')
    .eq('id', body.eventId)
    .gte('starts_at', new Date().toISOString())
    .gt('spots_left', 0)
    .single()
  if (eventError || !event) return NextResponse.json({ error: 'event_unavailable' }, { status: 409 })

  const { data: decremented, error: decrementError } = await context.supabase
    .from('demo_invest_events')
    .update({ spots_left: event.spots_left - 1 })
    .eq('id', event.id)
    .gt('spots_left', 0)
    .select('id')
  if (decrementError || !decremented?.length) return NextResponse.json({ error: 'event_unavailable' }, { status: 409 })

  const { data: booking, error: bookingError } = await context.supabase
    .from('demo_invest_event_bookings')
    .insert({ user_id: context.user.id, event_id: event.id, status: 'booked' })
    .select('id, user_id, event_id, booked_at, status')
    .single()
  if (bookingError) {
    await context.supabase.from('demo_invest_events').update({ spots_left: event.spots_left }).eq('id', event.id)
    return NextResponse.json({ error: 'booking_failed' }, { status: 500 })
  }

  await context.supabase.from('demo_invest_user_funnel').upsert({
    user_id: context.user.id,
    event_booked: true,
    event_booked_at: new Date().toISOString(),
    invest_avond_geclaimd: true,
    invest_avond_verschenen: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  await emitEvent({
    type: 'event.booked',
    user: context.user,
    funnel: context.funnel,
    data: {
      booking_type: 'masterclass_edition_candidate',
      selected_edition: {
        id: event.id,
        title: event.title,
        starts_at: event.starts_at,
        location: event.location,
      },
      event,
      booking,
    },
  })
  await emitEvent({
    type: 'bonus.unlocked',
    user: context.user,
    funnel: context.funnel,
    data: { unlock_reason: 'event_booked', event_id: event.id },
  })

  return NextResponse.json({ ok: true, booking })
}
