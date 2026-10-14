import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'di_session'

const PUBLIC_PREFIXES = [
  '/login',
  '/activeren',
  '/api/auth/',
  '/api/activeren',
  '/api/account-aanmaken',
  '/api/hubspot/hot-lead',
  '/api/cron/',
  '/api/setup-db',
  '/_next',
  '/favicon',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Let public paths through
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const hasSession = !!req.cookies.get(COOKIE_NAME)?.value

  if (!hasSession) {
    // API routes return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // App routes redirect to login and preserve the requested page.
    const url = req.nextUrl.clone()
    const destination = `${req.nextUrl.pathname}${req.nextUrl.search}`
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', destination)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)'],
}
