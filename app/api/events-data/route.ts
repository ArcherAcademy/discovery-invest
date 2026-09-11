import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const [{ data: eventsData }, { data: bookingsData }] = await Promise.all([
    supabase
      .from('demo_invest_events')
      .select('*')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at'),
    supabase.from('demo_invest_event_bookings').select('*').eq('user_id', user.id),
  ])

  return NextResponse.json({
    events: eventsData ?? [],
    bookings: bookingsData ?? [],
  })
}
