import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase-omgeving is niet geconfigureerd')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function pick(body: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = body[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

export async function POST(request: Request) {
  let body: Record<string, unknown>

  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: 'Ongeldige JSON-body' }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Ongeldige JSON-body' }, { status: 400 })
  }

  const email = pick(body, ['email', 'contact_email']).toLowerCase()
  const leadOwnerId = pick(body, ['lead_owner_id', 'owner_id', 'hubspot_owner_id'])

  if (!email || !leadOwnerId) {
    return NextResponse.json(
      { ok: false, error: 'email en lead_owner_id zijn verplicht' },
      { status: 400 },
    )
  }

  try {
    const supabase = createAdminClient()
    const { data: users, error: lookupError } = await supabase
      .from('demo_invest_users')
      .select('id,email')
      .ilike('email', email)
      .order('created_at', { ascending: false })

    if (lookupError) throw lookupError
    if (!users?.length) {
      return NextResponse.json({ ok: false, error: 'Account niet gevonden' }, { status: 404 })
    }

    const userIds = users.map(user => user.id)
    const { data: updatedUsers, error: updateError } = await supabase
      .from('demo_invest_users')
      .update({ hubspot_owner_id: leadOwnerId })
      .in('id', userIds)
      .select('id,email,hubspot_owner_id')

    if (updateError) throw updateError
    const updatedUser = updatedUsers?.[0]
    if (!updatedUser) throw new Error('Geen account bijgewerkt')

    const { data: bookingLinks, error: ownerError } = await supabase
      .from('demo_invest_boekingslinks')
      .select('naam')
      .eq('hubspot_owner_id', leadOwnerId)
      .eq('actief', true)
      .eq('is_default', false)
      .limit(1)

    if (ownerError) throw ownerError

    return NextResponse.json({
      ok: true,
      email: updatedUser.email,
      lead_owner_id: updatedUser.hubspot_owner_id,
      lead_owner_name: bookingLinks?.[0]?.naam ?? 'Onbekend',
    })
  } catch (error) {
    console.error('[lead-owner] Lead owner opslaan mislukt:', error)
    return NextResponse.json(
      { ok: false, error: 'Lead owner kon niet worden opgeslagen' },
      { status: 500 },
    )
  }
}
