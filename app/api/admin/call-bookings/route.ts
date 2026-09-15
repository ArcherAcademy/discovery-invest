import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { getAdminCallBookings } from '@/lib/call-booking-data'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  try {
    const bookings = await getAdminCallBookings(createAdminClient())
    return NextResponse.json({ bookings, generated_at: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Calls konden niet worden geladen.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
