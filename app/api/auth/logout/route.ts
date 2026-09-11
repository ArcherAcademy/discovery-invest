import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  await destroySession(req)
  const response = NextResponse.json({ ok: true })
  const isProduction = process.env.NODE_ENV === 'production'
  response.cookies.set('di_session', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
