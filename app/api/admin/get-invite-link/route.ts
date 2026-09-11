import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// TIJDELIJKE ROUTE — verwijder na gebruik
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const email = searchParams.get('email') ?? 'ward@archer.finance'
  const { data, error } = await supabase
    .from('demo_invest_invites')
    .select('raw_token, created_at, used_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'geen invite gevonden', detail: error?.message })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://discovery.archerinvest.app'
  return NextResponse.json({
    email,
    raw_token: data.raw_token,
    used_at: data.used_at,
    created_at: data.created_at,
    link: `${appUrl}/activeren?token=${data.raw_token}`,
  })
}
