import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSession, applySessionCookie } from '@/lib/auth'
import { emitEvent } from '@/lib/emit-event'
import { fireInstant } from '@/lib/workflow-engine'
import type { DemoUser, DemoUserFunnel } from '@/lib/types'

async function sha256hex(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function activationError(req: NextRequest, message: string, status: number, browserNavigation: boolean) {
  if (browserNavigation) {
    const url = new URL('/activeren', req.url)
    url.searchParams.set('error', message)
    return NextResponse.redirect(url, { status: 303 })
  }
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function activate(req: NextRequest, token: string, browserNavigation: boolean) {
  if (!token) return activationError(req, 'Geen activatietoken gevonden.', 400, browserNavigation)

  const supabase = createAdminClient()
  const tokenHash = await sha256hex(token)
  const { data: invite, error: inviteError } = await supabase
    .from('demo_invest_invites')
    .select('id, user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (inviteError || !invite) {
    return activationError(req, 'Deze activatielink is ongeldig.', 400, browserNavigation)
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const trialExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Slechts één gelijktijdig verzoek kan de eerste activatie claimen. Daardoor
  // blijven activatie-events en CRM-stages idempotent, ook bij dubbelklikken.
  const { data: newlyActivated, error: activationErrorResult } = await supabase
    .from('demo_invest_users')
    .update({
      activated_at: nowIso,
      trial_started_at: nowIso,
      trial_expires_at: trialExpiresAt,
      last_activity_at: nowIso,
    })
    .eq('id', invite.user_id)
    .is('activated_at', null)
    .select('*')
    .maybeSingle()

  if (activationErrorResult) {
    return activationError(req, 'Activatie mislukt. Probeer het opnieuw.', 500, browserNavigation)
  }

  let user = newlyActivated as DemoUser | null
  const isFirstActivation = Boolean(user)

  if (!user) {
    const { data: existingUser, error: userError } = await supabase
      .from('demo_invest_users')
      .select('*')
      .eq('id', invite.user_id)
      .maybeSingle()

    if (userError || !existingUser?.activated_at) {
      return activationError(req, 'Het account bij deze link bestaat niet meer.', 404, browserNavigation)
    }
    user = existingUser as DemoUser
  }

  let funnel: DemoUserFunnel | null = null
  if (isFirstActivation) {
    const { data: funnelData, error: funnelError } = await supabase
      .from('demo_invest_user_funnel')
      .upsert({
        user_id: user.id,
        videos_completed_count: 0,
        all_completed_at: null,
        event_booked: false,
        event_booked_at: null,
      }, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (funnelError) {
      return activationError(req, 'De activatie kon niet volledig worden opgeslagen.', 500, browserNavigation)
    }
    funnel = funnelData as DemoUserFunnel

    await supabase
      .from('demo_invest_invites')
      .update({ used_at: nowIso })
      .eq('id', invite.id)

    await emitEvent({
      type: 'trial.account_activated',
      user,
      funnel,
      data: { stage: 'account_activated', activated_at: user.activated_at },
    })

    try {
      await fireInstant(supabase, 'welkom', user, new Set(), {
        trial_expires_at: user.trial_expires_at,
      })
    } catch {
      // De welkomstworkflow is aanvullend en mag directe toegang nooit blokkeren.
    }
  }

  try {
    const rawToken = await createSession(user.id)
    const response = NextResponse.redirect(new URL('/home', req.url), { status: 303 })
    applySessionCookie(response, rawToken)
    return response
  } catch (error) {
    console.error('[activate] sessie aanmaken gefaald:', error)
    return activationError(req, 'Inloggen mislukt. Open de activatielink opnieuw.', 500, browserNavigation)
  }
}

export async function GET(req: NextRequest) {
  return activate(req, req.nextUrl.searchParams.get('token') ?? '', true)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { token?: unknown }
  return activate(req, typeof body.token === 'string' ? body.token : '', false)
}
