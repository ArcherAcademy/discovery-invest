import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { HUBSPOT_CODE } from '@/lib/hubspot-codes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/admin/test-trigger
 * Stuurt een vrije testtrigger naar de centrale HubSpot-webhook.
 * Body: { hubspotCode: string, email: string, naam: string }
 * Geen grendel — altijd verstuurd, ook meerdere keren.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ ok: false, error: 'Geen toegang.' }, { status: 401 })

  const { hubspotCode, email, naam } = await req.json()

  if (!hubspotCode || !email) {
    return NextResponse.json({ ok: false, error: 'hubspotCode en email zijn verplicht.' }, { status: 400 })
  }

  // Valideer dat het een bekende code is
  const allCodes = Object.values(HUBSPOT_CODE)
  if (!allCodes.includes(hubspotCode)) {
    return NextResponse.json({
      ok: false,
      error: `Onbekende HubSpot code "${hubspotCode}". Gebruik een van de 18 geldige codes.`,
    }, { status: 400 })
  }

  // Centrale webhook URL
  const { data: centralCfg } = await supabase
    .from('demo_invest_webhook_config')
    .select('webhook_url')
    .eq('trigger_naam', '__central__')
    .maybeSingle()

  const centralUrl = process.env.HUBSPOT_WEBHOOK_URL?.trim()
    ?? centralCfg?.webhook_url?.trim()
    ?? ''

  if (!centralUrl) {
    return NextResponse.json({ ok: false, error: 'Geen centrale webhook URL geconfigureerd.' }, { status: 400 })
  }

  const payload = {
    workflow: hubspotCode,
    email:    email.trim(),
    naam:     (naam ?? '').trim(),
  }

  let status: 'verstuurd' | 'gefaald' = 'verstuurd'
  let responseStatus: string | null = null
  let fout: string | null = null

  try {
    const res = await fetch(centralUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    })
    responseStatus = String(res.status)
    if (!res.ok) {
      status = 'gefaald'
      fout = `HTTP ${res.status}`
    }
  } catch (err) {
    status = 'gefaald'
    fout = err instanceof Error ? err.message : 'Onbekende fout'
    responseStatus = `fetch_error: ${fout}`
  }

  // Log elke testverzending
  await supabase.from('demo_invest_trigger_log').insert({
    user_id:         null,
    contact_email:   email.trim(),
    workflow_naam:   hubspotCode,
    workflow_nummer: null,
    status,
    reden:           fout ?? 'handmatige test vanuit admin',
    payload_json:    { ...payload, manueel: true, test: true, door: admin.id },
    response_status: responseStatus,
  })

  if (status === 'gefaald') {
    return NextResponse.json({ ok: false, error: `Webhook gefaald: ${fout}`, responseStatus }, { status: 502 })
  }

  return NextResponse.json({ ok: true, hubspot_code: hubspotCode, email: email.trim(), responseStatus })
}
