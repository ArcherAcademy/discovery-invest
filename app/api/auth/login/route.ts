import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSession, applySessionCookie } from '@/lib/auth'
import type { DemoUser } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ ok: false, error: 'E-mailadres is vereist.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const normalizedEmail = (email as string).toLowerCase().trim()
  const { data: users, error: userError } = await supabase
    .from('demo_invest_users')
    .select('id, email, activated_at, role')
    .ilike('email', normalizedEmail)
    .order('activated_at', { ascending: false })

  if (userError) {
    console.error('[v0] login: gebruiker ophalen gefaald:', userError.message)
    return NextResponse.json({ ok: false, error: 'Inloggen mislukt. Probeer het opnieuw.' }, { status: 500 })
  }

  // Kies het meest recent geactiveerde account voor dit e-mailadres.
  // Historische imports kunnen meerdere records met hetzelfde e-mailadres bevatten.
  const candidates = (users ?? []) as DemoUser[]
  const typedUser = candidates[0] ?? null

  if (!typedUser) {
    return NextResponse.json({ ok: false, error: 'Geen account gevonden voor dit e-mailadres.' }, { status: 401 })
  }

  // Admins bypass the activated_at check — they are set up directly in the DB
  if (!typedUser.activated_at && typedUser.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Dit account is nog niet geactiveerd. Gebruik de activatielink uit je e-mail.' },
      { status: 403 }
    )
  }

  await supabase
    .from('demo_invest_users')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', typedUser.id)

  // Clean up expired + old sessions for this user before creating a new one
  await supabase
    .from('demo_invest_sessions')
    .delete()
    .eq('user_id', typedUser.id)
    .lt('expires_at', new Date().toISOString())

  let rawToken: string
  try {
    rawToken = await createSession(typedUser.id)
  } catch (err) {
    console.error('[v0] login: sessie aanmaken gefaald:', err)
    return NextResponse.json({ ok: false, error: 'Inloggen mislukt. Probeer het opnieuw.' }, { status: 500 })
  }

  // Zet de cookie op een gewone fetch-response. Dit werkt ook in de v0-preview,
  // waar handmatige fetch-redirects de Set-Cookie-header niet betrouwbaar bewaren.
  const response = NextResponse.json({ ok: true })
  applySessionCookie(response, rawToken)
  return response
}
