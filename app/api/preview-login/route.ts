import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applySessionCookie, createSession } from '@/lib/auth'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const { data: user, error } = await supabase
    .from('demo_invest_users')
    .select('id')
    .eq('email', 'ward@archer.finn')
    .maybeSingle()

  if (error || !user) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden.' }, { status: 404 })
  }

  const token = await createSession(user.id)
  const response = NextResponse.redirect(new URL('/home', request.url))
  applySessionCookie(response, token)
  return response
}
