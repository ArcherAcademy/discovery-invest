import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = createAdminClient()

  // Only allow known safe fields — never let the client write arbitrary columns
  const allowed: Record<string, unknown> = {}
  if (typeof body.whatsapp_opt_in === 'boolean') allowed.whatsapp_opt_in = body.whatsapp_opt_in

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid fields to update.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('demo_invest_users')
    .update(allowed)
    .eq('id', user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
