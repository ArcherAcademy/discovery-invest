import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function sha256hex(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ valid: false, error: 'Geen token opgegeven.' })
  }

  const tokenHash = await sha256hex(token)
  const supabase = createAdminClient()

  const { data: invite } = await supabase
    .from('demo_invest_invites')
    .select('id, user_id, email, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ valid: false, error: 'Deze activatielink is ongeldig.' })
  }
  if (invite.used_at) {
    // The link was already used to finish activation. Instead of showing a
    // dead-end error, signal the frontend to send the user to /login — they
    // already have a password and can simply sign in.
    return NextResponse.json({
      valid: false,
      alreadyUsed: true,
      error: 'Deze activatielink is al gebruikt. Je kunt inloggen met je wachtwoord.',
    })
  }
  // Activatielinks verlopen niet meer. Een invite blijft geldig tot hij
  // gebruikt is (used_at gezet bij activatie). expires_at wordt bewust
  // genegeerd, ook voor invites die eerder met 48 uur geldigheid zijn
  // aangemaakt.

  // Haal de naam op uit het voorlopige profiel
  const { data: profile } = await supabase
    .from('demo_invest_users')
    .select('name')
    .eq('id', invite.user_id)
    .maybeSingle()

  return NextResponse.json({
    valid: true,
    email: invite.email,
    name: profile?.name ?? null,
  })
}
