import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { resolveBookingLink } from '@/lib/booking-links'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const booking = await resolveBookingLink(supabase, user.contact_owner_email)

  if (!booking) {
    return NextResponse.json({ available: false })
  }

  if (!user.call_opened_at) {
    await supabase
      .from('demo_invest_users')
      .update({ call_opened_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('call_opened_at', null)
  }

  return NextResponse.json({ available: true, ...booking })
}
