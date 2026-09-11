import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { HUBSPOT_CODE } from '@/lib/hubspot-codes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ ok: false, error: 'Geen toegang.' }, { status: 401 })

  const { userId, triggerNaam } = await req.json()
  if (!userId || !triggerNaam) {
    return NextResponse.json({ ok: false, error: 'userId en triggerNaam zijn verplicht.' }, { status: 400 })
  }

  // Fetch user
  const { data: user } = await supabase
    .from('demo_invest_users')
    .select('id, email, name')
    .eq('id', userId)
    .maybeSingle()

  if (!user) return NextResponse.json({ ok: false, error: 'Gebruiker niet gevonden.' }, { status: 404 })

  // Centrale webhook URL: env var heeft voorrang, daarna __central__ config-rij
  const { data: centralCfg } = await supabase
    .from('demo_invest_webhook_config')
    .select('webhook_url, actief')
    .eq('trigger_naam', '__central__')
    .maybeSingle()

  const centralUrl = process.env.HUBSPOT_WEBHOOK_URL?.trim()
    ?? centralCfg?.webhook_url?.trim()
    ?? ''

  if (!centralUrl) {
    return NextResponse.json({ ok: false, error: 'Geen centrale webhook URL geconfigureerd.' }, { status: 400 })
  }

  // Payload — exact formaat dat HubSpot verwacht
  const hubspotCode = HUBSPOT_CODE[triggerNaam] ?? triggerNaam
  const payload = {
    workflow: hubspotCode,
    email:    user.email,
    naam:     user.name ?? '',
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

  // Log — gebruik workflow_naam consistent met de rest van de log-tabel
  await supabase.from('demo_invest_trigger_log').insert({
    user_id:         user.id,
    contact_email:   user.email,
    workflow_naam:   triggerNaam,
    workflow_nummer: null,
    status,
    reden:           fout ?? (status === 'verstuurd' ? 'handmatig verstuurd vanuit admin' : null),
    payload_json:    { ...payload, manueel: true },
    response_status: responseStatus,
  })

  if (status === 'gefaald') {
    return NextResponse.json({ ok: false, error: `Webhook gefaald: ${fout}` }, { status: 502 })
  }

  return NextResponse.json({ ok: true, hubspot_code: hubspotCode, email: user.email })
}
