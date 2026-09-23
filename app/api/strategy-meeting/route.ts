import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitEvent } from '@/lib/emit-event'
import { updateCallUserState } from '@/lib/call-booking-data'
import type { DemoUser, DemoUserFunnel } from '@/lib/types'

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const [{ data: userData, error: userError }, { data: funnelData, error: funnelError }] = await Promise.all([
    supabase.from('demo_invest_users').select('*').eq('id', authUser.id).single(),
    supabase.from('demo_invest_user_funnel').select('*').eq('user_id', authUser.id).maybeSingle(),
  ])
  if (userError) return NextResponse.json({ error: 'user_unavailable' }, { status: 500 })
  if (funnelError) return NextResponse.json({ error: 'funnel_unavailable' }, { status: 500 })

  const user = userData as DemoUser
  const funnel = funnelData as DemoUserFunnel | null
  const now = new Date().toISOString()
  const state = await updateCallUserState(supabase, user.id, {
    call_opened_at: now,
    call_clicked_at: now,
    call_booked: true,
    call_booked_at: now,
  })

  await supabase.from('demo_invest_user_funnel').upsert({
    user_id: user.id,
    event_booked: true,
    event_booked_at: now,
    invest_avond_geclaimd: true,
    invest_avond_verschenen: true,
    updated_at: now,
  }, { onConflict: 'user_id' })

  await emitEvent({
    type: 'call.booked',
    user,
    funnel,
    data: { booking_type: 'strategymeeting', requested_at: now, status: 'requested', owner_notified: true },
  })
  await emitEvent({
    type: 'bonus.unlocked',
    user,
    funnel,
    data: { unlock_reason: 'strategymeeting_requested' },
  })

  return NextResponse.json({ ok: true, state })
}
