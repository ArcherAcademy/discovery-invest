import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { kiesBoekingslink, maakEmbedUrl, type Boekingslink } from '@/lib/adviesgesprek'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Niet aangemeld.' }, { status: 401 })

  const supabase = createAdminClient()
  const [{ data: funnel }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from('demo_invest_user_funnel')
      .select('all_completed_at, call_screen_opened_at, call_booking_clicked_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('demo_invest_boekingslinks')
      .select('id, hubspot_owner_id, naam, booking_url, actief, is_default')
      .eq('actief', true),
  ])

  const heeftToegang = user.role === 'admin' || user.role === 'mentor' || Boolean(funnel?.all_completed_at)
  if (!heeftToegang) {
    return NextResponse.json({ error: 'Rond eerst alle 6 video’s af.' }, { status: 403 })
  }
  if (linksError) return NextResponse.json({ error: 'De agenda kon niet worden geladen.' }, { status: 500 })

  const gekozenLink = kiesBoekingslink(user.hubspot_owner_id, (links ?? []) as Boekingslink[])
  if (!gekozenLink) {
    return NextResponse.json(
      { error: 'Er is nog geen actieve standaardagenda ingesteld. Neem contact op met Archer.' },
      { status: 503 },
    )
  }

  return NextResponse.json({
    booking: {
      naam: gekozenLink.naam,
      booking_url: gekozenLink.booking_url,
      embed_url: maakEmbedUrl(gekozenLink.booking_url),
      routing: gekozenLink.is_default ? 'round_robin' : 'owner',
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Niet aangemeld.' }, { status: 401 })

  const body = await req.json().catch(() => null) as { action?: unknown } | null
  if (body?.action !== 'open' && body?.action !== 'click') {
    return NextResponse.json({ error: 'Ongeldige actie.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: funnel } = await supabase
    .from('demo_invest_user_funnel')
    .select('all_completed_at, call_screen_opened_at, call_booking_clicked_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const heeftToegang = user.role === 'admin' || user.role === 'mentor' || Boolean(funnel?.all_completed_at)
  if (!heeftToegang) return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })

  const veld = body.action === 'open' ? 'call_screen_opened_at' : 'call_booking_clicked_at'
  if (funnel?.[veld]) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('demo_invest_user_funnel')
    .update({ [veld]: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'De call-stap kon niet worden geregistreerd.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
