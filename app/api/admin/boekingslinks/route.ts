import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface LinkInput {
  id?: unknown
  hubspot_owner_id?: unknown
  naam?: unknown
  booking_url?: unknown
  actief?: unknown
  is_default?: unknown
}

function parseInput(body: LinkInput) {
  const naam = typeof body.naam === 'string' ? body.naam.trim() : ''
  const bookingUrl = typeof body.booking_url === 'string' ? body.booking_url.trim() : ''
  const ownerId = typeof body.hubspot_owner_id === 'string' ? body.hubspot_owner_id.trim() : ''

  if (!naam || !bookingUrl) throw new Error('Naam en booking-URL zijn verplicht.')
  const url = new URL(bookingUrl)
  if (url.protocol !== 'https:') throw new Error('Gebruik een geldige https-URL.')

  const isDefault = body.is_default === true
  if (!isDefault && !ownerId) throw new Error('Een accountmanager heeft een HubSpot owner-ID nodig.')

  return {
    hubspot_owner_id: isDefault ? null : ownerId,
    naam,
    booking_url: url.toString(),
    actief: body.actief !== false,
    is_default: isDefault,
  }
}

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unauthorized'
  return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
}

export async function GET(req: NextRequest) {
  try { await requireAdmin(req) } catch (error) { return authError(error) }

  const { data, error } = await createAdminClient()
    .from('demo_invest_boekingslinks')
    .select('id, hubspot_owner_id, naam, booking_url, actief, is_default')
    .order('is_default', { ascending: false })
    .order('naam')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(req) } catch (error) { return authError(error) }

  const body = await req.json().catch(() => null) as LinkInput | null
  if (!body) return NextResponse.json({ error: 'Ongeldige gegevens.' }, { status: 400 })

  let input
  try { input = parseInput(body) } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ongeldige gegevens.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (input.is_default) {
    const { error } = await supabase.from('demo_invest_boekingslinks').update({ is_default: false }).eq('is_default', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const id = typeof body.id === 'string' ? body.id : null
  const query = id
    ? supabase.from('demo_invest_boekingslinks').update(input).eq('id', id).select().single()
    : supabase.from('demo_invest_boekingslinks').insert(input).select().single()
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data })
}

export async function DELETE(req: NextRequest) {
  try { await requireAdmin(req) } catch (error) { return authError(error) }

  const body = await req.json().catch(() => null) as { id?: unknown } | null
  if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Ongeldige link.' }, { status: 400 })

  const { error } = await createAdminClient().from('demo_invest_boekingslinks').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
