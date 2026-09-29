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

  const now = new Date()
  const nowIso = now.toISOString()
  const accountUpdate: {
    activated_at?: string
    last_activity_at: string
    trial_started_at?: string
    trial_expires_at?: string
  } = {
    last_activity_at: nowIso,
  }

  // De discovery-login is het herstelpad voor klanten die hun activatiemail
  // nooit hebben geopend. Bestaande accounts activeren bij de eerste login;
  // onbekende e-mailadressen worden hierboven nog steeds geweigerd.
  if (!hasPermanentAccess(typedUser.role) && !typedUser.activated_at) {
    accountUpdate.activated_at = nowIso
    accountUpdate.trial_started_at = nowIso
    accountUpdate.trial_expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: activationUpdateError } = await supabase
      .from('demo_invest_users')
      .update(accountUpdate)
      .eq('id', typedUser.id)
      .is('activated_at', null)

    if (activationUpdateError) {
      console.error('[v0] login: automatische activatie gefaald:', activationUpdateError.message)
      return NextResponse.json({ ok: false, error: 'Inloggen mislukt. Probeer het opnieuw.' }, { status: 500 })
    }

    await supabase
      .from('demo_invest_user_funnel')
      .upsert({ user_id: typedUser.id, videos_completed_count: 0, all_completed_at: null, event_booked: false }, { onConflict: 'user_id' })

    await supabase
      .from('demo_invest_invites')
      .update({ used_at: nowIso })
      .eq('user_id', typedUser.id)
      .is('used_at', null)

    typedUser.activated_at = nowIso
    typedUser.trial_started_at = nowIso
    typedUser.trial_expires_at = accountUpdate.trial_expires_at
  } else {
    if (!hasPermanentAccess(typedUser.role) && typedUser.activated_at) {
      const trialStartedAt = typedUser.trial_started_at ?? typedUser.activated_at
      accountUpdate.trial_started_at = trialStartedAt
      accountUpdate.trial_expires_at = typedUser.trial_expires_at ?? new Date(new Date(trialStartedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    await supabase
      .from('demo_invest_users')
      .update(accountUpdate)
      .eq('id', typedUser.id)
  }

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
