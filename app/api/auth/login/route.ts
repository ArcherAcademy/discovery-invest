import { NextRequest, NextResponse } from 'next/server'
import {
  createAuthMarker,
  ensureDiscoveryAuthUser,
  getDiscoveryAuthEmail,
  parseAuthMarker,
  verifyLegacyPassword,
} from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { DemoUser } from '@/lib/types'

type LoginCandidate = DemoUser & { password_hash: string }

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.json({ ok: false, error: 'E-mail en wachtwoord zijn vereist.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const supabase = await createClient()
  const normalizedEmail = email.toLowerCase().trim()
  const { data: users, error: userError } = await admin
    .from('demo_invest_users')
    .select('id, email, password_hash, activated_at, role')
    .ilike('email', normalizedEmail)
    .not('password_hash', 'is', null)
    .neq('password_hash', '')
    .order('activated_at', { ascending: false })

  if (userError) {
    console.error('[v0] login: gebruiker ophalen gefaald:', userError.message)
    return NextResponse.json({ ok: false, error: 'Inloggen mislukt. Probeer het opnieuw.' }, { status: 500 })
  }

  const candidates = (users ?? []) as LoginCandidate[]
  let authenticatedUser: LoginCandidate | null = null

  for (const candidate of candidates) {
    if (!parseAuthMarker(candidate.password_hash)) continue
    if (!candidate.activated_at && candidate.role !== 'admin') continue

    const { error } = await supabase.auth.signInWithPassword({
      email: getDiscoveryAuthEmail(candidate.id),
      password,
    })
    if (!error) {
      authenticatedUser = candidate
      break
    }
  }

  if (!authenticatedUser) {
    for (const candidate of candidates) {
      if (!candidate.activated_at && candidate.role !== 'admin') continue
      if (!(await verifyLegacyPassword(password, candidate.password_hash))) continue

      try {
        const { authUser } = await ensureDiscoveryAuthUser(candidate.id, password)
        const { error: markerError } = await admin
          .from('demo_invest_users')
          .update({ password_hash: createAuthMarker(authUser.id) })
          .eq('id', candidate.id)

        if (markerError) throw new Error(markerError.message)

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: getDiscoveryAuthEmail(candidate.id),
          password,
        })
        if (signInError) throw signInError

        authenticatedUser = candidate
        break
      } catch (error) {
        console.error('[v0] login: migratie naar Supabase Auth gefaald:', error)
        return NextResponse.json({ ok: false, error: 'Inloggen mislukt. Probeer het opnieuw.' }, { status: 500 })
      }
    }
  }

  if (!authenticatedUser) {
    return NextResponse.json({ ok: false, error: 'Ongeldige e-mail of wachtwoord.' }, { status: 401 })
  }

  await admin
    .from('demo_invest_users')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', authenticatedUser.id)

  return NextResponse.json({ ok: true })
}
