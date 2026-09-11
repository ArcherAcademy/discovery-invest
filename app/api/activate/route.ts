import { NextResponse } from 'next/server'

/**
 * This route is no longer used.
 * Activation is handled by /api/activeren/activate (invite-based flow).
 * Login is handled by /api/auth/login.
 */
export async function POST() {
  return NextResponse.json({ ok: true })
}
