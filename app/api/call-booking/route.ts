import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getCallUserState, resolveBookingLink, updateCallUserState } from '@/lib/call-booking-data'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: funnel } = await supabase
    .from('demo_invest_user_funnel')
    .select('videos_completed_count')
    .eq('user_id', user.id)
    .maybeSingle()

  if ((funnel?.videos_completed_count ?? 0) < 6) {
    return NextResponse.json({ available: false })
  }

  const callState = await getCallUserState(supabase, user.id)
  const booking = await resolveBookingLink(supabase, callState.contact_owner_email)
  if (!booking) return NextResponse.json({ available: false })

  if (!callState.call_opened_at) {
    await updateCallUserState(supabase, user.id, { call_opened_at: new Date().toISOString() })
  }

  return NextResponse.json({ available: true, ...booking })
}
