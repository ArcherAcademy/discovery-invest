import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = new Set(['user', 'mentor'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req)
  if (!actor) {
    return NextResponse.json({ error: 'Alleen admins kunnen rollen beheren.' }, { status: 403 })
  }

  let body: { userId?: unknown; role?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 })
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const role = typeof body.role === 'string' ? body.role.trim() : ''

  if (!UUID_PATTERN.test(userId) || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json(
      { error: 'Geef een geldige gebruiker en rol (user of mentor).' },
      { status: 400 },
    )
  }

  if (userId === actor.id) {
    return NextResponse.json({ error: 'Je kunt je eigen rol niet wijzigen.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: target, error: fetchError } = await supabase
    .from('demo_invest_users')
    .select('id, email, name, role')
    .eq('id', userId)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!target) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden.' }, { status: 404 })
  }
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Adminrollen kunnen hier niet worden gewijzigd.' }, { status: 400 })
  }

  const allowedTransition =
    (target.role === 'user' && role === 'mentor') ||
    (target.role === 'mentor' && role === 'user')

  if (!allowedTransition) {
    return NextResponse.json({ error: `Overgang van ${target.role} naar ${role} is niet toegestaan.` }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('demo_invest_users')
    .update({ role })
    .eq('id', userId)
    .eq('role', target.role)
    .select('*')
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'De rol is intussen gewijzigd. Vernieuw en probeer opnieuw.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, user: updated })
}
