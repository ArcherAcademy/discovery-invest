import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const GELDIGE_STATUSSEN = new Set(['nieuw', 'in_behandeling', 'bevestigd', 'afgewezen'])

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()
  const { data: claims, error } = await supabase
    .from('demo_invest_event_claims')
    .select('id, user_id, mobiel_nummer, datum_keuze, claimed_at, status, contacted_at, webhook_status, fraud_status')
    .order('claimed_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Claims konden niet worden geladen.' }, { status: 500 })

  const userIds = [...new Set((claims ?? []).map(claim => claim.user_id))]
  const { data: users } = userIds.length
    ? await supabase.from('demo_invest_users').select('id, name, email').in('id', userIds)
    : { data: [] }
  const usersOpId = new Map((users ?? []).map(item => [item.id, item]))

  return NextResponse.json({
    claims: (claims ?? []).map(claim => ({
      ...claim,
      naam: usersOpId.get(claim.user_id)?.name ?? '',
      email: usersOpId.get(claim.user_id)?.email ?? '',
    })),
  })
}

export async function PATCH(req: NextRequest) {
  let admin
  try {
    admin = await requireAdmin(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const body = await req.json().catch(() => null) as { id?: unknown; status?: unknown; contacted?: unknown } | null
  if (!body || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Ongeldige claim.' }, { status: 400 })
  }

  const updates: Record<string, string | null> = {}
  if (typeof body.status === 'string' && GELDIGE_STATUSSEN.has(body.status)) updates.status = body.status
  if (typeof body.contacted === 'boolean') {
    updates.contacted_at = body.contacted ? new Date().toISOString() : null
    updates.contacted_by = body.contacted ? admin.id : null
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Geen geldige wijziging.' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('demo_invest_event_claims')
    .update(updates)
    .eq('id', body.id)
    .select('id, status, contacted_at')
    .single()

  if (error) return NextResponse.json({ error: 'Wijziging kon niet worden opgeslagen.' }, { status: 500 })
  return NextResponse.json({ claim: data })
}
