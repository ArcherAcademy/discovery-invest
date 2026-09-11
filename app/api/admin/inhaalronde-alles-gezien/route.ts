import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { HUBSPOT_CODE } from '@/lib/hubspot-codes'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * EENMALIGE INHAALRONDE — alleen voor W10 alles_gezien_c1.
 *
 * Achtergrond: door een foute mapping vertrok deze trigger wekenlang met de
 * code mail_10_alles_gezien en belandde daardoor in de None-tak van HubSpot.
 * De mapping is gecorrigeerd naar mail_11_alles_gezien, maar de send-once
 * grendel staat voor die mensen al op verstuurd, dus de gewone engine vuurt
 * nooit meer. Deze route haalt dat eenmalig in.
 *
 * Waarom de log en niet de grendel bepaalt wie in aanmerking komt:
 * demo_invest_trigger_sent bevat alleen (user_id, workflow_naam) — daar staat
 * geen code in, dus daaruit is niet af te leiden of iemand de foute of de
 * juiste mail kreeg. De trigger-log heeft ook geen hubspot_code-kolom; die
 * waarde zit in payload_json. Daarop filteren we, want dat is het enige veld
 * dat de foute van de gefixte verzending onderscheidt.
 *
 * GET  = preview (verstuurt niets)
 * POST = versturen naar een expliciet bevestigde selectie
 */

const WORKFLOW_NAAM = 'alles_gezien_c1'
const WORKFLOW_NUMMER = 10 // interne nummering; komt overeen met bestaande logrijen
const CODE = HUBSPOT_CODE[WORKFLOW_NAAM] // 'mail_11_alles_gezien'
const INTERNE_DOMEINEN = /@(archer\.finance|archer\.academy)$/i

interface Kandidaat {
  user_id: string
  email: string
  naam: string
  all_completed_at: string | null
  intern: boolean
}

/**
 * Bepaalt de doelgroep. Preview en verzending roepen exact deze functie aan,
 * zodat de lijst die iemand bevestigt niet kan afwijken van wat er vertrekt.
 */
async function bepaalKandidaten(): Promise<Kandidaat[]> {
  // 1. Iedereen met all_completed_at gezet
  const { data: funnels } = await supabase
    .from('demo_invest_user_funnel')
    .select('user_id, all_completed_at')
    .not('all_completed_at', 'is', null)

  const ids = (funnels ?? []).map(f => f.user_id)
  if (ids.length === 0) return []

  const voltooidOp = new Map<string, string | null>(
    (funnels ?? []).map(f => [f.user_id, f.all_completed_at])
  )

  const { data: users } = await supabase
    .from('demo_invest_users')
    .select('id, email, name')
    .in('id', ids)

  // 2. Eruit: wie de gefixte mail al kreeg (status verstuurd én de juiste code)
  const { data: logs } = await supabase
    .from('demo_invest_trigger_log')
    .select('user_id, contact_email, payload_json')
    .eq('workflow_naam', WORKFLOW_NAAM)
    .eq('status', 'verstuurd')

  // Uitsluiten gebeurt op E-MAILADRES, niet op user_id. Sommige mensen hebben
  // twee accounts met hetzelfde adres; bij uitsluiten per user_id schuift het
  // tweede account in de plaats van het eerste zodra dat bediend is, en krijgt
  // datzelfde adres bij een volgende ronde alsnog een tweede mail.
  const emailPerUser = new Map<string, string>(
    (users ?? []).map(u => [u.id, (u.email ?? '').trim().toLowerCase()])
  )
  const alGehad = new Set<string>()
  for (const l of logs ?? []) {
    if ((l.payload_json as { hubspot_code?: string } | null)?.hubspot_code !== CODE) continue
    const adres = (l.contact_email ?? '').trim().toLowerCase() || emailPerUser.get(l.user_id) || ''
    if (adres) alGehad.add(adres)
  }

  // 3. Ontdubbelen op e-mailadres — sommige adressen hebben twee accounts
  const perEmail = new Map<string, Kandidaat>()
  for (const u of users ?? []) {
    const email = (u.email ?? '').trim()
    if (alGehad.has(email.toLowerCase())) continue
    if (!email) continue
    const sleutel = email.toLowerCase()
    if (perEmail.has(sleutel)) continue
    perEmail.set(sleutel, {
      user_id: u.id,
      email,
      naam: u.name ?? '',
      all_completed_at: voltooidOp.get(u.id) ?? null,
      intern: INTERNE_DOMEINEN.test(email),
    })
  }

  return [...perEmail.values()].sort((a, b) => a.email.localeCompare(b.email))
}

/** GET — preview. Verstuurt niets. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ ok: false, error: 'Geen toegang.' }, { status: 401 })

  const kandidaten = await bepaalKandidaten()
  return NextResponse.json({
    ok: true,
    hubspot_code: CODE,
    kandidaten,
    totaal: kandidaten.length,
    intern: kandidaten.filter(k => k.intern).length,
  })
}

/** POST — versturen. Body: { userIds: string[] } */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ ok: false, error: 'Geen toegang.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const gevraagd: unknown = body?.userIds
  if (!Array.isArray(gevraagd) || gevraagd.length === 0) {
    return NextResponse.json({ ok: false, error: 'Geen selectie ontvangen.' }, { status: 400 })
  }

  // Doelgroep server-side opnieuw bepalen en de selectie daarop snijden.
  // De client kan zo nooit iemand toevoegen die er niet in hoort, ook niet
  // als de preview intussen verouderd is.
  const kandidaten = await bepaalKandidaten()
  const toegestaan = new Map(kandidaten.map(k => [k.user_id, k]))
  const selectie = (gevraagd as string[]).map(id => toegestaan.get(id)).filter((k): k is Kandidaat => !!k)
  const genegeerd = gevraagd.length - selectie.length

  if (selectie.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'Niemand uit de selectie komt nog in aanmerking — mogelijk is de inhaalronde al uitgevoerd.',
    }, { status: 400 })
  }

  // Dezelfde centrale webhook als alle andere triggers
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

  const resultaten: Array<{
    email: string
    naam: string
    status: 'verstuurd' | 'gefaald'
    response: string | null
  }> = []

  for (const [i, k] of selectie.entries()) {
    // Korte pauze tussen elke POST — HubSpot niet overspoelen
    if (i > 0) await new Promise(r => setTimeout(r, 300))

    // Exact dezelfde payloadvorm als de engine: workflow, email, naam
    const payload = { workflow: CODE, email: k.email, naam: k.naam }

    let status: 'verstuurd' | 'gefaald' = 'verstuurd'
    let responseStatus: string | null = null
    let fout: string | null = null

    try {
      const res = await fetch(centralUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
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

    // Loggen zoals elke andere trigger. De hubspot_code in payload_json is
    // wat deze persoon bij een volgende run uit de preview houdt.
    await supabase.from('demo_invest_trigger_log').insert({
      user_id: k.user_id,
      contact_email: k.email,
      workflow_nummer: WORKFLOW_NUMMER,
      workflow_naam: WORKFLOW_NAAM,
      status,
      reden: fout ?? 'eenmalige inhaalronde alles-gezien',
      payload_json: {
        ...payload,
        hubspot_code: CODE,
        workflow_naam: WORKFLOW_NAAM,
        workflow_nummer: WORKFLOW_NUMMER,
        contact_email: k.email,
        inhaalronde: true,
        door: admin.id,
        timestamp: new Date().toISOString(),
      },
      response_status: responseStatus,
    })

    // Grendel zetten voor wie er nog geen had, zodat de gewone engine deze
    // trigger hierna niet alsnog een tweede keer afvuurt.
    if (status === 'verstuurd') {
      await supabase
        .from('demo_invest_trigger_sent')
        .upsert(
          { user_id: k.user_id, workflow_naam: WORKFLOW_NAAM },
          { onConflict: 'user_id,workflow_naam', ignoreDuplicates: true },
        )
    }

    resultaten.push({ email: k.email, naam: k.naam, status, response: responseStatus })
  }

  return NextResponse.json({
    ok: true,
    hubspot_code: CODE,
    verstuurd: resultaten.filter(r => r.status === 'verstuurd').length,
    gefaald: resultaten.filter(r => r.status === 'gefaald').length,
    genegeerd,
    resultaten,
  })
}
