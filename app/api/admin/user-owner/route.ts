import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { updateCallUserState } from '@/lib/call-booking-data'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const body = await req.json() as { user_id?: string; contact_owner_email?: string | null; call_booked?: boolean }
  if (!body.user_id) return NextResponse.json({ error: 'user_id ontbreekt.' }, { status: 400 })

  const updates: Parameters<typeof updateCallUserState>[2] = {}
  if ('contact_owner_email' in body) updates.contact_owner_email = body.contact_owner_email?.trim().toLowerCase() || null
  if (typeof body.call_booked === 'boolean') {
    updates.call_booked = body.call_booked
    updates.call_booked_at = body.call_booked ? new Date().toISOString() : null
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Geen wijzigingen ontvangen.' }, { status: 400 })

  try {
    const state = await updateCallUserState(createAdminClient(), body.user_id, updates)
    return NextResponse.json({ ok: true, state })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Opslaan mislukt.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
