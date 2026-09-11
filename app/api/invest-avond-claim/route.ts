import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const TELEFOON_PATTERN = /^[+\d][\d\s()./-]{7,19}$/

function isGeldigeDatum(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const datum = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(datum.getTime()) && datum.toISOString().startsWith(value)
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Niet aangemeld.' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('demo_invest_event_claims')
    .select('id, mobiel_nummer, datum_keuze, claimed_at, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Claimstatus kon niet worden geladen.' }, { status: 500 })
  return NextResponse.json({ claim: data ?? null })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Niet aangemeld.' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    mobiel_nummer?: unknown
    datum_keuze?: unknown
    website?: unknown
  } | null

  if (!body || typeof body.mobiel_nummer !== 'string' || typeof body.datum_keuze !== 'string') {
    return NextResponse.json({ error: 'Vul alle verplichte velden in.' }, { status: 400 })
  }

  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ error: 'De aanvraag kon niet worden verwerkt.' }, { status: 400 })
  }

  const mobielNummer = body.mobiel_nummer.trim()
  const datumKeuze = body.datum_keuze.trim()
  const vandaag = new Date().toISOString().slice(0, 10)

  if (!TELEFOON_PATTERN.test(mobielNummer)) {
    return NextResponse.json({ error: 'Vul een geldig mobiel nummer in.' }, { status: 400 })
  }
  if (!isGeldigeDatum(datumKeuze) || datumKeuze < vandaag) {
    return NextResponse.json({ error: 'Kies een geldige toekomstige datum.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const [{ data: funnel }, { data: bestaandeClaim }] = await Promise.all([
    supabase
      .from('demo_invest_user_funnel')
      .select('all_completed_at, videos_completed_count')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('demo_invest_event_claims')
      .select('id, mobiel_nummer, datum_keuze, claimed_at, status')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (bestaandeClaim) {
    await supabase
      .from('demo_invest_event_claims')
      .update({ fraud_status: 'dubbele_poging' })
      .eq('id', bestaandeClaim.id)
    return NextResponse.json({ claim: bestaandeClaim, duplicate: true })
  }

  if (!funnel?.all_completed_at || Number(funnel.videos_completed_count) < 6) {
    return NextResponse.json({ error: 'Voltooi eerst alle 6 kernvideo’s.' }, { status: 403 })
  }

  const voltooidNaMs = user.activated_at
    ? new Date(funnel.all_completed_at).getTime() - new Date(user.activated_at).getTime()
    : Number.POSITIVE_INFINITY
  const fraudStatus = voltooidNaMs >= 0 && voltooidNaMs < 15 * 60 * 1000 ? 'verdacht_snel' : 'ok'

  const { data: claim, error: insertError } = await supabase
    .from('demo_invest_event_claims')
    .insert({
      user_id: user.id,
      mobiel_nummer: mobielNummer,
      datum_keuze: datumKeuze,
      status: 'nieuw',
      webhook_status: 'niet_verzonden',
      fraud_status: fraudStatus,
    })
    .select('id, mobiel_nummer, datum_keuze, claimed_at, status')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Je aanvraag werd al geregistreerd.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Je aanvraag kon niet worden opgeslagen.' }, { status: 500 })
  }

  const { data: centraleConfig } = await supabase
    .from('demo_invest_webhook_config')
    .select('webhook_url')
    .eq('trigger_naam', '__central__')
    .maybeSingle()
  const webhookUrl = process.env.HUBSPOT_WEBHOOK_URL?.trim() || centraleConfig?.webhook_url?.trim() || ''

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: 'INVEST_AVOND_CLAIM',
          naam: user.name ?? '',
          email: user.email,
          mobiel_nummer: mobielNummer,
          datum_keuze: datumKeuze,
          claimed_at: claim.claimed_at,
        }),
        signal: AbortSignal.timeout(8000),
      })
      await supabase
        .from('demo_invest_event_claims')
        .update({ webhook_status: response.ok ? 'verstuurd' : `mislukt_http_${response.status}` })
        .eq('id', claim.id)
    } catch {
      await supabase
        .from('demo_invest_event_claims')
        .update({ webhook_status: 'mislukt_netwerk' })
        .eq('id', claim.id)
    }
  }

  return NextResponse.json({ claim }, { status: 201 })
}
