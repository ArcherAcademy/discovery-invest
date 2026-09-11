import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  await destroySession(req)
  const response = NextResponse.json({ ok: true })
  response.cookies.set('di_session', '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}
