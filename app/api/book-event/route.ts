import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitEvent } from '@/lib/emit-event'
import { fireInstant } from '@/lib/workflow-engine'
import type { DemoUser, DemoUserFunnel } from '@/lib/types'

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createAdminClient()

  const { eventId, action } = await req.json() as { eventId: string; action: 'book' | 'cancel' }
  const now = new Date()

  const [{ data: funnelData }] = await Promise.all([
    supabase.from('demo_invest_user_funnel').select('*').eq('user_id', authUser.id).single(),
  ])

  const user = authUser as DemoUser
  const funnel = funnelData as DemoUserFunnel

  if (action === 'book') {
    if (!funnel || funnel.videos_completed_count < 6) {
      return NextResponse.json({ error: 'Unlock 6 core videos first' }, { status: 403 })
    }

    // Check existing booking
    const { data: existing } = await supabase
      .from('demo_invest_event_bookings')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('event_id', eventId)
      .single()

    if (existing && existing.status === 'booked') {
      return NextResponse.json({ ok: true, alreadyBooked: true })
    }

    if (existing) {
      await supabase.from('demo_invest_event_bookings').update({ status: 'booked', booked_at: now.toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('demo_invest_event_bookings').insert({
        user_id: authUser.id,
        event_id: eventId,
        booked_at: now.toISOString(),
        status: 'booked',
      })
    }

    // Update funnel
    await supabase.from('demo_invest_user_funnel').update({
      event_booked: true,
      event_booked_at: now.toISOString(),
    }).eq('user_id', authUser.id)

    // Update spots_left
    await supabase.rpc('demo_invest_decrement_spots', { event_id: eventId }).catch(() => {
      // Ignore if RPC doesn't exist
    })

    await emitEvent({
      type: 'event.booked',
      user,
      funnel: { ...funnel, event_booked: true, event_booked_at: now.toISOString() },
      nextVideo: null,
      data: { event_id: eventId },
    })
    // W14 — instant: workshop boeking bevestigd
    const { data: existingLogRows } = await supabase
      .from('demo_invest_trigger_log')
      .select('workflow_naam')
      .eq('user_id', authUser.id)
      .eq('status', 'verstuurd')
    const firedNamen = new Set<string>((existingLogRows ?? []).map((r: { workflow_naam: string }) => r.workflow_naam))
    await fireInstant(supabase, 'workshop_bevestiging', user, firedNamen, { event_id: eventId })
  } else if (action === 'cancel') {
    await supabase.from('demo_invest_event_bookings')
      .update({ status: 'cancelled' })
      .eq('user_id', authUser.id)
      .eq('event_id', eventId)

    await supabase.from('demo_invest_user_funnel').update({
      event_booked: false,
      event_booked_at: null,
    }).eq('user_id', authUser.id)

    await emitEvent({
      type: 'event.booking_cancelled',
      user,
      funnel: { ...funnel, event_booked: false, event_booked_at: null },
      nextVideo: null,
      data: { event_id: eventId },
    })
  }

  return NextResponse.json({ ok: true })
}
