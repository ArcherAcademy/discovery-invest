import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { resolveBookingLink } from '@/lib/booking-links'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const supabase = createAdminClient()
  const booking = await resolveBookingLink(supabase, user.contact_owner_email)
  if (!booking) return NextResponse.redirect(new URL('/traject', req.url))

  await supabase
    .from('demo_invest_users')
    .update({ call_clicked_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.redirect(booking.booking_url)
}
