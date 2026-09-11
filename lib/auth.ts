/**
 * lib/auth.ts
 *
 * Custom session auth — fully independent of Supabase Auth (auth.users).
 * All demo data lives in demo_invest_* tables.
 * Every function runs server-side with the service-role client.
 */

import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DemoUser } from '@/lib/types'

// ── Constants ────────────────────────────────────────────────────────────────

const COOKIE_NAME = 'di_session'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const BCRYPT_ROUNDS = 12

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sha256hex(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateRawToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ── Session management ────────────────────────────────────────────────────────

/**
 * Create a new session for the given user and store the hash in DB.
 * Returns the raw token so the caller can set the cookie on the NextResponse.
 */
export async function createSession(userId: string): Promise<string> {
  const supabase = createAdminClient()
  const rawToken = generateRawToken()
  const tokenHash = await sha256hex(rawToken)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()

  const { error } = await supabase
    .from('demo_invest_sessions')
    .insert({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt })

  if (error) {
    throw new Error(`Session creation failed: ${error.message}`)
  }

  return rawToken
}

/**
 * Apply the session cookie to a NextResponse.
 * Call this immediately after createSession() in route handlers.
 */
export function applySessionCookie(response: import('next/server').NextResponse, rawToken: string): void {
  const expires = new Date(Date.now() + SESSION_DURATION_MS)
  response.cookies.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  })
}

/**
 * Read the session cookie, look up the hash in DB, return the user.
 * Pass `req` when calling from a Route Handler; omit it in Server Components.
 */
export async function getSessionUser(req?: import('next/server').NextRequest): Promise<DemoUser | null> {
  let rawToken: string | undefined
  if (req) {
    rawToken = req.cookies.get(COOKIE_NAME)?.value
  } else {
    const cookieStore = await cookies()
    rawToken = cookieStore.get(COOKIE_NAME)?.value
  }
  if (!rawToken) return null

  const tokenHash = await sha256hex(rawToken)
  const supabase = createAdminClient()

  const { data: session, error: sessionError } = await supabase
    .from('demo_invest_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!session) return null
  if (new Date(session.expires_at) < new Date()) {
    // Expired — clean up silently
    await supabase.from('demo_invest_sessions').delete().eq('token_hash', tokenHash)
    return null
  }

  const { data: user } = await supabase
    .from('demo_invest_users')
    .select('*')
    .eq('id', session.user_id)
    .maybeSingle()

  return (user as DemoUser) ?? null
}

/**
 * Destroy the current session: delete from DB.
 * Returns the cookie-clear options to apply on the NextResponse.
 */
export async function destroySession(req: import('next/server').NextRequest): Promise<void> {
  const rawToken = req.cookies.get(COOKIE_NAME)?.value
  if (rawToken) {
    const tokenHash = await sha256hex(rawToken)
    const supabase = createAdminClient()
    await supabase.from('demo_invest_sessions').delete().eq('token_hash', tokenHash)
  }
}

/**
 * Assert admin — throws if session user is not an admin.
 * Pass `req` when calling from a Route Handler.
 */
export async function requireAdmin(req?: import('next/server').NextRequest): Promise<DemoUser> {
  const user = await getSessionUser(req)
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'admin') throw new Error('Forbidden')
  return user
}

/**
 * Assert admin or mentor — throws if session user is neither.
 * Use this for routes that both roles may access (overview, accounts, voortgang, users).
 * Pass `req` when calling from a Route Handler.
 */
export async function requireAdminOrMentor(req?: import('next/server').NextRequest): Promise<DemoUser> {
  const user = await getSessionUser(req)
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'admin' && user.role !== 'mentor') throw new Error('Forbidden')
  return user
}
