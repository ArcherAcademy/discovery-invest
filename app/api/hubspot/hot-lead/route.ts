import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getHubSpotOwner } from '@/lib/hubspot-owners'
import { createAdminClient } from '@/lib/supabase/admin'

const INVEST_PIPELINE_ID = '3961435370'
const WAITLIST_WEBSITE_STAGE_ID = '5938491641'
const DEFAULT_TELEGRAM_WEBHOOK = 'https://n8n.archer-server.com/webhook/discovery-editie-keuze'
const MELDING_TYPE = 'hot_lead_telegram'

interface HubSpotWebhookPayload {
  webhook_secret?: unknown
  objectId?: unknown
  lead_id?: unknown
  hs_object_id?: unknown
  propertyValue?: unknown
  hs_pipeline_stage?: unknown
}

interface HubSpotLead {
  id: string
  properties?: {
    hs_pipeline?: string | null
    hs_pipeline_stage?: string | null
    hs_lead_name?: string | null
    hubspot_owner_id?: string | null
    hs_lead_primary_contact_owner?: string | null
  }
  associations?: {
    contacts?: {
      results?: Array<{ id: string }>
    }
  }
}

interface HubSpotContact {
  id: string
  properties?: {
    firstname?: string | null
    lastname?: string | null
    email?: string | null
    phone?: string | null
    mobilephone?: string | null
    hubspot_owner_id?: string | null
  }
}

function scalarText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function secureEqual(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length
    && timingSafeEqual(receivedBuffer, expectedBuffer)
}

async function hubSpotRequest<T>(path: string): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN ontbreekt')

  const response = await fetch(`https://api.hubapi.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    const responseBody = await response.text()
    throw new Error(`HubSpot API ${response.status}: ${responseBody.slice(0, 300)}`)
  }

  return response.json() as Promise<T>
}

async function updateLog(
  id: string,
  outcome: 'created' | 'error',
  reden: string,
  httpStatus: number,
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('demo_invest_account_webhook_log')
    .update({ outcome, reden, http_status: httpStatus })
    .eq('id', id)

  if (error) console.error('[hubspot/hot-lead] Webhooklog bijwerken mislukt:', error)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  let parsedBody: unknown

  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const payload = (Array.isArray(parsedBody) ? parsedBody[0] : parsedBody) as HubSpotWebhookPayload | undefined
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const expectedSecret = process.env.HUBSPOT_WEBHOOK_SECRET?.trim() ?? ''
  const receivedSecret = scalarText(payload.webhook_secret)
  if (!expectedSecret) {
    console.error('[hubspot/hot-lead] HUBSPOT_WEBHOOK_SECRET ontbreekt')
    return NextResponse.json({ error: 'server_misconfiguration' }, { status: 500 })
  }
  if (!receivedSecret || !secureEqual(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const leadId = scalarText(payload.objectId)
    || scalarText(payload.lead_id)
    || scalarText(payload.hs_object_id)
  if (!/^\d+$/.test(leadId)) {
    return NextResponse.json({ error: 'missing_lead_id' }, { status: 422 })
  }

  const suppliedStage = scalarText(payload.propertyValue) || scalarText(payload.hs_pipeline_stage)
  if (suppliedStage && suppliedStage !== WAITLIST_WEBSITE_STAGE_ID) {
    return NextResponse.json({ ok: true, ignored: 'other_stage' })
  }

  let lead: HubSpotLead
  try {
    lead = await hubSpotRequest<HubSpotLead>(
      `/crm/v3/objects/leads/${encodeURIComponent(leadId)}`
      + '?properties=hs_pipeline,hs_pipeline_stage,hs_lead_name,hubspot_owner_id,hs_lead_primary_contact_owner'
      + '&associations=contacts',
    )
  } catch (error) {
    console.error('[hubspot/hot-lead] Lead ophalen mislukt:', error)
    return NextResponse.json({ error: 'hubspot_lead_unavailable' }, { status: 502 })
  }

  if (
    lead.properties?.hs_pipeline !== INVEST_PIPELINE_ID
    || lead.properties?.hs_pipeline_stage !== WAITLIST_WEBSITE_STAGE_ID
  ) {
    return NextResponse.json({ ok: true, ignored: 'lead_not_in_target_stage' })
  }

  const supabase = createAdminClient()
  const { data: existingNotification, error: lookupError } = await supabase
    .from('demo_invest_account_webhook_log')
    .select('id')
    .contains('payload_json', { melding_type: MELDING_TYPE, lead_id: leadId })
    .eq('outcome', 'created')
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    console.error('[hubspot/hot-lead] Idempotentiecontrole mislukt:', lookupError)
    return NextResponse.json({ error: 'idempotency_check_failed' }, { status: 500 })
  }
  if (existingNotification) {
    return NextResponse.json({ ok: true, alreadySent: true })
  }

  const uniqueContactIds = Array.from(new Set(
    lead.associations?.contacts?.results?.map(contact => contact.id).filter(Boolean) ?? [],
  ))
  const contactId = uniqueContactIds[0]

  let contact: HubSpotContact | null = null
  if (contactId) {
    try {
      contact = await hubSpotRequest<HubSpotContact>(
        `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`
        + '?properties=firstname,lastname,email,phone,mobilephone,hubspot_owner_id',
      )
    } catch (error) {
      console.error('[hubspot/hot-lead] Contact ophalen mislukt:', error)
      return NextResponse.json({ error: 'hubspot_contact_unavailable' }, { status: 502 })
    }
  }

  const fullName = lead.properties?.hs_lead_name?.trim() ?? ''
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const firstName = contact?.properties?.firstname?.trim() || nameParts.shift() || 'Onbekend'
  const lastName = contact?.properties?.lastname?.trim() || nameParts.join(' ')
  const email = contact?.properties?.email?.trim().toLowerCase() || null
  const phone = contact?.properties?.mobilephone?.trim()
    || contact?.properties?.phone?.trim()
    || ''
  const ownerId = lead.properties?.hubspot_owner_id?.trim()
    || lead.properties?.hs_lead_primary_contact_owner?.trim()
    || contact?.properties?.hubspot_owner_id?.trim()
    || null
  const ownerName = getHubSpotOwner(ownerId)?.name ?? ''

  const safePayload = {
    melding_type: MELDING_TYPE,
    lead_id: leadId,
    contact_id: contactId ?? null,
    bron: 'website',
    lead_flow: 'evergreen',
    lead_stage: 'Qualified: Waitlist Website',
    email,
    telefoon: phone,
    lead_owner: ownerName,
  }

  const { data: reservedLog, error: reserveError } = await supabase
    .from('demo_invest_account_webhook_log')
    .insert({
      email,
      payload_json: safePayload,
      outcome: 'reused',
      reden: 'Telegrammelding wordt verstuurd',
      activatielink: null,
      http_status: 202,
    })
    .select('id')
    .single()

  if (reserveError || !reservedLog) {
    console.error('[hubspot/hot-lead] Melding reserveren mislukt:', reserveError)
    return NextResponse.json({ error: 'notification_reservation_failed' }, { status: 500 })
  }

  const telegramPayload = {
    voornaam: firstName,
    naam: lastName,
    email: email ?? '',
    telefoon: phone,
    gekozen_editie: 'Hot lead · Website (evergreen)',
    lead_owner: { naam: ownerName },
    melding_type: MELDING_TYPE,
    bron: 'website',
    lead_flow: 'evergreen',
    lead_stage: 'Qualified: Waitlist Website',
    hubspot_lead_id: leadId,
    tekst: 'Nieuwe hot lead via Website · Evergreen',
  }

  const telegramWebhook = process.env.HOT_LEAD_TELEGRAM_WEBHOOK_URL?.trim()
    || DEFAULT_TELEGRAM_WEBHOOK

  try {
    const telegramResponse = await fetch(telegramWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramPayload),
      signal: AbortSignal.timeout(8_000),
    })

    if (!telegramResponse.ok) {
      await updateLog(reservedLog.id, 'error', `n8n antwoordde met ${telegramResponse.status}`, 502)
      return NextResponse.json({ error: 'telegram_webhook_failed' }, { status: 502 })
    }
  } catch (error) {
    console.error('[hubspot/hot-lead] n8n niet bereikbaar:', error)
    await updateLog(reservedLog.id, 'error', 'n8n niet bereikbaar', 502)
    return NextResponse.json({ error: 'telegram_webhook_unavailable' }, { status: 502 })
  }

  await updateLog(reservedLog.id, 'created', 'Telegrammelding verstuurd', 200)

  return NextResponse.json({ ok: true, sent: true })
}
