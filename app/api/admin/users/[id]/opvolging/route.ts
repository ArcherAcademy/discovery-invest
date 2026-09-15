import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OPVOLGING_UIT_MARKER = '__automatische_opvolging_uit__'

async function authorize(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await authorize(req)
  if (authError) return authError

  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Ongeldige gebruiker.' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('demo_invest_trigger_sent')
    .select('id')
    .eq('user_id', id)
    .eq('workflow_naam', OPVOLGING_UIT_MARKER)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'De opvolgingsstatus kon niet worden opgehaald.' }, { status: 500 })
  return NextResponse.json({ ok: true, opvolging_actief: !data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await authorize(req)
  if (authError) return authError

  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Ongeldige gebruiker.' }, { status: 400 })

  let body: { actief?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 })
  }
  if (typeof body.actief !== 'boolean') {
    return NextResponse.json({ error: 'Geef een geldige opvolgingsstatus.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: user } = await supabase
    .from('demo_invest_users')
    .select('id')
    .eq('id', id)
    .eq('role', 'user')
    .maybeSingle()
  if (!user) return NextResponse.json({ error: 'Gebruiker niet gevonden.' }, { status: 404 })

  const result = body.actief
    ? await supabase.from('demo_invest_trigger_sent').delete().eq('user_id', id).eq('workflow_naam', OPVOLGING_UIT_MARKER)
    : await supabase.from('demo_invest_trigger_sent').upsert(
        { user_id: id, workflow_naam: OPVOLGING_UIT_MARKER },
        { onConflict: 'user_id,workflow_naam', ignoreDuplicates: true },
      )

  if (result.error) {
    return NextResponse.json({ error: 'De opvolgingsstatus kon niet worden opgeslagen.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, opvolging_actief: body.actief })
}
