import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSession, applySessionCookie } from '@/lib/auth'
import { fireInstant } from '@/lib/workflow-engine'
import type { DemoUser } from '@/lib/types'

async function sha256hex(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Token is vereist.' }, { status: 400 })
  }

  const tokenHash = await sha256hex(token)
  const supabase = createAdminClient()

  // ── 1. Invite ophalen en valideren ────────────────────────────────────────
  const { data: invite } = await supabase
    .from('demo_invest_invites')
    .select('id, user_id, email, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ ok: false, error: 'Ongeldige activatielink.' }, { status: 400 })
  }

  if (invite.used_at) {
    // If the invite is already used, check whether the account was actually
    // activated. If it was, the user is fully activated — create a new session
    // so they land on /home immediately. If not, a prior attempt failed
    // mid-way, so allow the activation to proceed.
    const { data: existingUser } = await supabase
      .from('demo_invest_users')
      .select('activated_at')
      .eq('id', invite.user_id)
      .maybeSingle()

    if (existingUser?.activated_at) {
      const rawToken = await createSession(invite.user_id)
      const redirectUrl = new URL('/home', req.url)
      const response = NextResponse.redirect(redirectUrl, { status: 303 })
      applySessionCookie(response, rawToken)
      return response
    }
    // Not activated yet — fall through to complete activation
  }

  // Geen vervalcheck meer: een activatielink blijft geldig tot hij gebruikt is.

  const userId = invite.user_id
  const now = new Date()
  const trialExpires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: userBeforeActivation } = await supabase
    .from('demo_invest_users')
    .select('activated_at')
    .eq('id', userId)
    .maybeSingle()

  const isPasswordReset = Boolean(userBeforeActivation?.activated_at)

  // ── 2. Profiel activeren (geen wachtwoord meer, alleen e-mail) ────────────
  const userUpdate = isPasswordReset
    ? {
        last_activity_at: now.toISOString(),
      }
    : {
        activated_at: now.toISOString(),
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpires.toISOString(),
        last_activity_at: now.toISOString(),
      }

  const { error: activateError } = await supabase
    .from('demo_invest_users')
    .update(userUpdate)
    .eq('id', userId)

  if (activateError) {
    // Even if the UPDATE returned an error, verify whether it actually wrote.
    // Some DB configurations fire a side-effect after a successful write.
    const { data: checkUser } = await supabase
      .from('demo_invest_users')
      .select('activated_at')
      .eq('id', userId)
      .maybeSingle()

    if (!checkUser?.activated_at) {
      return NextResponse.json(
        { ok: false, error: 'Activatie mislukt. Neem contact op via info@archerinvest.nl.' },
        { status: 500 }
      )
    }
    // The write succeeded despite the error — continue
  }

  // ── 4. Funnel alleen bij eerste activatie aanmaken ────────────────────────
  if (!isPasswordReset) {
    await supabase
      .from('demo_invest_user_funnel')
      .upsert({
        user_id: userId,
        videos_completed_count: 0,
        all_completed_at: null,
        event_booked: false,
        event_booked_at: null,
      }, { onConflict: 'user_id' })
  }

  // ── 5. Invite sluiten ─────────────────────────────────────────────────────
  await supabase
    .from('demo_invest_invites')
    .update({ used_at: now.toISOString() })
    .eq('id', invite.id)

  // ── 6. Sessie aanmaken ────────────────────────────────────────────────────
  let rawToken: string
  try {
    rawToken = await createSession(userId)
  } catch (err) {
    console.error('[activate] sessie aanmaken gefaald:', err)
    return NextResponse.json(
      { ok: false, error: 'Sessie aanmaken mislukt. Log in via /login.' },
      { status: 500 }
    )
  }

  // ── 7. Welkom-trigger alleen bij eerste activatie (non-fatal) ─────────────
  if (!isPasswordReset) {
    try {
      const { data: newUser } = await supabase
        .from('demo_invest_users')
        .select('*')
        .eq('id', userId)
        .single()

      if (newUser) {
        await fireInstant(supabase, 'welkom', newUser as DemoUser, new Set(), {
          trial_expires_at: (newUser as DemoUser).trial_expires_at,
        })
      }
    } catch { /* non-fatal */ }
  }

  // ── 8. Redirect naar /home als ingelogde gebruiker ────────────────────────
  const redirectUrl = new URL('/home', req.url)
  const response = NextResponse.redirect(redirectUrl, { status: 303 })
  applySessionCookie(response, rawToken!)
  return response
}
