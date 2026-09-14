import { NextRequest, NextResponse } from 'next/server'
import { createAuthMarker, ensureDiscoveryAuthUser, getDiscoveryAuthEmail } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fireInstant } from '@/lib/workflow-engine'
import type { DemoUser } from '@/lib/types'

async function sha256hex(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (typeof token !== 'string' || typeof password !== 'string' || !token || !password) {
    return NextResponse.json({ ok: false, error: 'Token en wachtwoord zijn vereist.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: 'Wachtwoord moet minstens 8 tekens bevatten.' }, { status: 400 })
  }

  const tokenHash = await sha256hex(token)
  const admin = createAdminClient()
  const { data: invite, error: inviteError } = await admin
    .from('demo_invest_invites')
    .select('id, user_id, email, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (inviteError || !invite) {
    return NextResponse.json({ ok: false, error: 'Ongeldige activatielink.' }, { status: 400 })
  }
  if (invite.used_at) {
    return NextResponse.json(
      { ok: false, error: 'Deze activatielink is al gebruikt. Log in via de inlogpagina.' },
      { status: 409 }
    )
  }

  const userId = invite.user_id
  const now = new Date()
  const trialExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  let authUserId: string

  try {
    const { authUser } = await ensureDiscoveryAuthUser(userId, password)
    authUserId = authUser.id
  } catch (error) {
    console.error('[v0] activeren: Supabase Auth-gebruiker aanmaken gefaald:', error)
    return NextResponse.json(
      { ok: false, error: 'Activatie mislukt. Neem contact op via info@archerinvest.nl.' },
      { status: 500 }
    )
  }

  const { error: activateError } = await admin
    .from('demo_invest_users')
    .update({
      password_hash: createAuthMarker(authUserId),
      activated_at: now.toISOString(),
      trial_started_at: now.toISOString(),
      trial_expires_at: trialExpires.toISOString(),
      last_activity_at: now.toISOString(),
    })
    .eq('id', userId)

  if (activateError) {
    console.error('[v0] activeren: profiel bijwerken gefaald:', activateError.message)
    return NextResponse.json(
      { ok: false, error: 'Activatie mislukt. Neem contact op via info@archerinvest.nl.' },
      { status: 500 }
    )
  }

  await admin.from('demo_invest_user_funnel').upsert(
    {
      user_id: userId,
      videos_completed_count: 0,
      all_completed_at: null,
      event_booked: false,
      event_booked_at: null,
    },
    { onConflict: 'user_id' }
  )

  await admin
    .from('demo_invest_invites')
    .update({ used_at: now.toISOString() })
    .eq('id', invite.id)

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: getDiscoveryAuthEmail(userId),
    password,
  })

  if (signInError) {
    console.error('[v0] activeren: Supabase-sessie aanmaken gefaald:', signInError.message)
    return NextResponse.json(
      { ok: false, error: 'Account geactiveerd. Log in via de inlogpagina.' },
      { status: 500 }
    )
  }

  try {
    const { data: newUser } = await admin
      .from('demo_invest_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (newUser) {
      await fireInstant(admin, 'welkom', newUser as DemoUser, new Set(), {
        trial_expires_at: (newUser as DemoUser).trial_expires_at,
      })
    }
  } catch {
    // De welkom-trigger mag een geslaagde activatie niet blokkeren.
  }

  return NextResponse.redirect(new URL('/home', req.url), { status: 303 })
}
