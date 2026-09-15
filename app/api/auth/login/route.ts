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

  const normalizedEmail = (email as string).toLowerCase().trim()
  const { data: users, error: userError } = await supabase
    .from('demo_invest_users')
    .select('id, email, password_hash, activated_at, role')
<<<<<<< HEAD
    .ilike('email', normalizedEmail)
    .not('password_hash', 'is', null)
    .neq('password_hash', '')
    .order('activated_at', { ascending: false })
=======
    .eq('email', (email as string).toLowerCase().trim())
    .not('password_hash', 'is', null)
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
>>>>>>> d07dbb592d769ac5132e83f8175d00cab89db11a

  if (userError) {
    console.error('[v0] login: gebruiker ophalen gefaald:', userError.message)
    return NextResponse.json({ ok: false, error: 'Inloggen mislukt. Probeer het opnieuw.' }, { status: 500 })
  }

  const candidates = (users ?? []) as Array<DemoUser & { password_hash: string }>
  let typedUser: (DemoUser & { password_hash: string }) | null = null

  // Historische imports kunnen meerdere records met hetzelfde e-mailadres bevatten.
  // Controleer daarom elk bruikbaar wachtwoordhash in plaats van willekeurig één record te kiezen.
  for (const candidate of candidates) {
    if (await verifyPassword(password, candidate.password_hash)) {
      typedUser = candidate
      break
    }
  }

  if (!typedUser) {
    return NextResponse.json({ ok: false, error: 'Ongeldige e-mail of wachtwoord.' }, { status: 401 })
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
