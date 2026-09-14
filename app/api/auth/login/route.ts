import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPassword, createSession, applySessionCookie } from '@/lib/auth'
import type { DemoUser } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'E-mail en wachtwoord zijn vereist.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: user } = await supabase
    .from('demo_invest_users')
    .select('id, email, password_hash, activated_at, role')
    .eq('email', (email as string).toLowerCase().trim())
    .not('password_hash', 'is', null)
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!user || !(user as DemoUser & { password_hash: string }).password_hash) {
    return NextResponse.json({ ok: false, error: 'Ongeldige e-mail of wachtwoord.' }, { status: 401 })
  }

  const typedUser = user as DemoUser & { password_hash: string }

  // Admins bypass the activated_at check — they are set up directly in the DB
  if (!typedUser.activated_at && typedUser.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Dit account is nog niet geactiveerd. Gebruik de activatielink uit je e-mail.' },
      { status: 403 }
    )
  }

  const valid = await verifyPassword(password, typedUser.password_hash)
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Ongeldige e-mail of wachtwoord.' }, { status: 401 })
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
