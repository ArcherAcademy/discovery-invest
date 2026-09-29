import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSession, applySessionCookie } from '@/lib/auth'
import type { DemoUser } from '@/lib/types'
import { hasPermanentAccess } from '@/lib/access'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ ok: false, error: 'E-mailadres is vereist.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const normalizedEmail = (email as string).toLowerCase().trim()
  const { data: users, error: userError } = await supabase
    .from('demo_invest_users')
    .select('id, email, activated_at, trial_started_at, trial_expires_at, role')
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
  if (!typedUser.activated_at && !hasPermanentAccess(typedUser.role)) {
    return NextResponse.json(
      { ok: false, error: 'Dit account is nog niet geactiveerd. Gebruik de activatielink uit je e-mail.' },
      { status: 403 }
    )
  }

  const now = new Date()
  const accountUpdate: { last_activity_at: string; trial_started_at?: string; trial_expires_at?: string } = {
    last_activity_at: now.toISOString(),
  }

  if (!hasPermanentAccess(typedUser.role) && typedUser.activated_at) {
    const trialStartedAt = typedUser.trial_started_at ?? typedUser.activated_at
    accountUpdate.trial_started_at = trialStartedAt
    accountUpdate.trial_expires_at = typedUser.trial_expires_at ?? new Date(new Date(trialStartedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }

  await supabase
    .from('demo_invest_users')
    .update(accountUpdate)
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
