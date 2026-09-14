import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PREFIXES = [
  '/login',
  '/activeren',
  '/api/auth/',
  '/api/activeren',
  '/api/account-aanmaken',
  '/api/cron/',
  '/api/setup-db',
  '/_next',
  '/favicon',
]

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const isProduction = process.env.NODE_ENV === 'production'
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return response

  if (!user) {
    if (pathname.startsWith('/api/')) {
      const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.getAll().forEach(cookie => unauthorized.cookies.set(cookie))
      return unauthorized
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}
