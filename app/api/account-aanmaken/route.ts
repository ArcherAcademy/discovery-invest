import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateCallUserState } from '@/lib/call-booking-data'
import { emitEvent } from '@/lib/emit-event'
import type { DemoUser } from '@/lib/types'
import { extractHubSpotOwnerId, getHubSpotOwner, getHubSpotOwnerByAdvisorName } from '@/lib/hubspot-owners'
import { scheduleLeadTimeline } from '@/lib/scheduled-messages'

// ── CORS helpers ──────────────────────────────────────────────────────────────
// Allow any origin so both the Lovable marketing site and HubSpot can call this.
// The endpoint is already secured by webhook_secret, so open CORS is safe here.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

// OPTIONS preflight — required for cross-origin POST from browsers (Lovable)
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// ── Timing-attack-safe string comparison ─────────────────────────────────────
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  if (bufA.length !== bufB.length) {
    // Still consume time to avoid length-based side channels
    let diff = 0
    for (let i = 0; i < Math.max(bufA.length, bufB.length); i++) {
      diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0)
    }
    return false
  }
  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}

// ── SHA-256 hash via Web Crypto (available in Edge + Node) ───────────────────
async function sha256hex(raw: string): Promise<string> {
  const buf = new TextEncoder().encode(raw)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function stableUserIdForEmail(email: string): Promise<string> {
  const hash = await sha256hex(`demo-invest-user:${email.trim().toLowerCase()}`)
  const bytes = hash.slice(0, 32).split('')
  bytes[12] = '5'
  bytes[16] = ((Number.parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16)
  const value = bytes.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

// ── Extract field with aliases ────────────────────────────────────────────────
// HubSpot stuurt waarden zowel vlak als onder `properties`, en propertywaarden
// kunnen een `{ value }`-object zijn. Normaliseer al die vormen zodat e-mail,
// instroom en lead owner niet stilzwijgend verloren gaan.
function scalarText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'bigint') return String(value)
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return scalarText((value as { value?: unknown }).value)
  }
  return ''
}

function pick(body: Record<string, unknown>, ...keys: string[]): string {
  const properties = body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
    ? body.properties as Record<string, unknown>
    : null

  for (const source of [body, properties]) {
    if (!source) continue
    for (const key of keys) {
      const value = scalarText(source[key])
      if (value) return value
    }
  }
  return ''
}

// Escape LIKE-wildcards (% en _) zodat een e-mailadres met zo'n teken bij een
// case-insensitieve ilike-match niet per ongeluk een ander account raakt.
function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INFLATIETEST_GUESSES = new Set(['ja', 'denk-ja', 'geen-idee', 'denk-nee'])
const INFLATIETEST_SITUATIONS = new Set(['werknemer', 'bv', 'zelfst', 'gepensioneerd'])
const INFLATIETEST_AGES = new Set([27, 35, 45, 55, 65])
const INFLATIETEST_LOANS = new Set([0, 0.12, 0.38, 0.7, null])
const INFLATIETEST_BLOCK_KEYS = ['cash', 'oblig', 'pensioen', 'fonds', 'vastgoed', 'etf', 'crypto'] as const
const DISCOVERY_ORIGIN = 'https://discovery.archerinvest.app'

type InflatietestAnswers = {
  guess: string
  situation: string
  age: number
  noHome: boolean
  homeValue?: number | null
  loan?: number | null
  assets: number
  blocks: Record<(typeof INFLATIETEST_BLOCK_KEYS)[number], number>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateInflatietestAnswers(value: unknown): value is InflatietestAnswers {
  if (!isRecord(value) || !isRecord(value.blocks)) return false
  const answerKeys = Object.keys(value).sort()
  const requiredAnswerKeys = ['age', 'assets', 'blocks', 'guess', 'homeValue', 'loan', 'noHome', 'situation']
  if (answerKeys.length !== requiredAnswerKeys.length || answerKeys.some((key, index) => key !== requiredAnswerKeys[index])) return false

  const blocksValue = value.blocks
  const blockKeys = Object.keys(blocksValue).sort()
  const requiredBlockKeys = [...INFLATIETEST_BLOCK_KEYS].sort()
  if (blockKeys.length !== requiredBlockKeys.length || blockKeys.some((key, index) => key !== requiredBlockKeys[index])) return false
  if (!INFLATIETEST_GUESSES.has(String(value.guess))) return false
  if (!INFLATIETEST_SITUATIONS.has(String(value.situation))) return false
  if (!INFLATIETEST_AGES.has(Number(value.age))) return false
  if (typeof value.noHome !== 'boolean' || !Number.isFinite(Number(value.assets)) || Number(value.assets) < 0) return false
  if (!value.noHome && (!Number.isFinite(Number(value.homeValue)) || Number(value.homeValue) < 0 || !INFLATIETEST_LOANS.has(value.loan as number | null))) return false

  const blocks = INFLATIETEST_BLOCK_KEYS.map(key => Number(blocksValue[key]))
  return blocks.every(block => Number.isInteger(block) && block >= 0 && block <= 10)
    && blocks.reduce((sum, block) => sum + block, 0) === 10
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function activationLink(rawToken: string): string {
  return `${DISCOVERY_ORIGIN}/activeren?token=${rawToken}`
}

function mistVermogenstestKolom(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return error.code === 'PGRST204'
    || message.includes('lead_flow')
    || message.includes('vermogenstest_variant')
    || message.includes('vermogenstest_vragenset')
}

// ── DB log helper (nooit blocking, nooit fatal) ───────────────────────────────
async function logWebhookCall(opts: {
  supabase: ReturnType<typeof createAdminClient>
  email: string | null
  payload_json: Record<string, unknown>
  outcome: 'created' | 'reused' | 'error'
  reden: string | null
  activatielink: string | null
  http_status: number
  user_id?: string | null
  submission_id?: string | null
}) {
  try {
    const { webhook_secret: _webhookSecret, ...veiligePayload } = opts.payload_json
    await opts.supabase.from('demo_invest_account_webhook_log').insert({
      email: opts.email,
      payload_json: veiligePayload,
      outcome: opts.outcome,
      reden: opts.reden,
      activatielink: opts.activatielink,
      http_status: opts.http_status,
      ...(opts.user_id ? { user_id: opts.user_id } : {}),
      ...(opts.submission_id && UUID_PATTERN.test(opts.submission_id) ? { submission_id: opts.submission_id } : {}),
    })
  } catch (err) {
    // Log fout mag de flow NOOIT breken
    console.error('[v0] account-aanmaken: loggen mislukt (non-fatal):', err)
  }
}

// ── Core handler (shared by both route aliases) ───────────────────────────────
async function handleWebhook(req: NextRequest): Promise<Response> {
  // Detect caller:
  //   - Lovable calls with ?format=json in the URL  → JSON response
  //   - HubSpot calls without that param            → plain-text response (backward compat)
  // Using a query param is more reliable than Accept-header sniffing because
  // HubSpot's "Send a webhook" action can send Accept: application/json unpredictably.
  const formatParam = req.nextUrl.searchParams.get('format')
  const acceptsJson = formatParam === 'json'
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? 'unknown'
  const bron = acceptsJson ? 'website' : 'hubspot'

  const rawPayload = await req.text()
  let body: Record<string, unknown>

  try {
    body = JSON.parse(rawPayload)
  } catch {
    return acceptsJson
      ? jsonError('Ongeldige JSON-body', 400)
      : new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS })
  }

  // ── 1. Admin-client zo vroeg mogelijk — nodig voor logging ────────────────
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('[v0] createAdminClient failed:', err)
    return new Response('Server misconfiguration', { status: 500 })
  }

  const emailRaw = pick(body, 'email', 'contact_email', 'hs_associated_contact_email').toLowerCase() || null

  // ── 2. Authenticeer via webhook_secret ────────────────────────────────────
  const expectedSecret = process.env.HUBSPOT_WEBHOOK_SECRET ?? ''
  const receivedSecret = typeof body.webhook_secret === 'string' ? body.webhook_secret : ''

  if (!expectedSecret) {
    console.error('[v0] HUBSPOT_WEBHOOK_SECRET is not set')
    await logWebhookCall({ supabase, email: emailRaw, payload_json: { ...body, _bron: bron, _origin: origin }, outcome: 'error', reden: 'Server misconfiguration: HUBSPOT_WEBHOOK_SECRET niet gezet', activatielink: null, http_status: 500 })
    return new Response('Server misconfiguration', { status: 500, headers: CORS_HEADERS })
  }

  if (!timingSafeEqual(receivedSecret, expectedSecret)) {
    console.warn('[v0] account-aanmaken: ongeldige webhook_secret')
    await logWebhookCall({ supabase, email: emailRaw, payload_json: { ...body, _bron: bron, _origin: origin }, outcome: 'error', reden: 'ongeldig webhook_secret', activatielink: null, http_status: 401 })
    return acceptsJson
      ? jsonError('Ongeldige webhook_secret', 401)
      : new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  // ── 3. Velden extraheren ──────────────────────────────────────────────────
  const email = emailRaw
  if (!email || !EMAIL_PATTERN.test(email)) {
    console.warn('[v0] account-aanmaken: ontbrekend of ongeldig e-mailadres')
    await logWebhookCall({ supabase, email, payload_json: { ...body, _bron: bron, _origin: origin }, outcome: 'error', reden: 'ontbrekend of ongeldig e-mailadres', activatielink: null, http_status: 400 })
    return acceptsJson
      ? jsonError('Ontbrekend of ongeldig verplicht veld: email', 400)
      : new Response('Missing or invalid email', { status: 400, headers: CORS_HEADERS })
  }

  let voornaam = pick(body, 'contact_first_name', 'firstname', 'first_name', 'voornaam', 'hs_associated_contact_firstname')
  let achternaam = pick(body, 'contact_last_name', 'lastname', 'last_name', 'achternaam', 'hs_associated_contact_lastname')

  // Fallback: split dealname
  if (!voornaam && !achternaam) {
    const dealname = pick(body, 'dealname', 'deal_name')
    if (dealname) {
      const parts = dealname.split(/\s+/)
      voornaam = parts[0] ?? ''
      achternaam = parts.slice(1).join(' ')
    }
  }

  const name = [voornaam, achternaam].filter(Boolean).join(' ') || email.split('@')[0]
  const source = pick(body, 'source')
  const leadFlow = pick(body, 'lead_flow') || (source === 'inflatietest' ? 'inflatietest' : null)
  const geldigeLeadFlows = new Set(['demo', 'vermogenstest', 'inflatietest'])
  if (leadFlow && !geldigeLeadFlows.has(leadFlow)) {
    await logWebhookCall({ supabase, email, payload_json: { ...body, _bron: bron, _origin: origin }, outcome: 'error', reden: `onbekende lead_flow: ${leadFlow}`, activatielink: null, http_status: 400 })
    return jsonError(`Onbekende lead_flow: ${leadFlow}`, 400)
  }

  const isInflatietest = leadFlow === 'inflatietest'
  const submissionId = pick(body, 'submission_id')
  const submittedAt = pick(body, 'submitted_at')
  const phone = pick(body, 'phone')
  const assignedAdvisor = pick(body, 'assigned_advisor')
  const answers = body.answers
  const result = pick(body, 'result')
  const resultDetails = body.result_details
  const advisorOwner = getHubSpotOwnerByAdvisorName(assignedAdvisor)

  if (source === 'inflatietest' && !isInflatietest) {
    await logWebhookCall({ supabase, email, payload_json: { ...body, _bron: bron, _origin: origin }, outcome: 'error', reden: 'lead_flow inflatietest ontbreekt', activatielink: null, http_status: 400 })
    return jsonError('lead_flow moet inflatietest zijn', 400)
  }

  if (isInflatietest) {
    const missingFields = [
      !voornaam && 'firstname',
      !achternaam && 'lastname',
      !phone && 'phone',
      !submissionId && 'submission_id',
      !source && 'source',
      !submittedAt && 'submitted_at',
      !assignedAdvisor && 'assigned_advisor',
      !result && 'result',
    ].filter(Boolean)

    let validationError = ''
    if (missingFields.length > 0) validationError = `Ontbrekende verplichte velden: ${missingFields.join(', ')}`
    else if (!UUID_PATTERN.test(submissionId)) validationError = 'submission_id moet een geldige UUID zijn'
    else if (pick(body, 'lead_id') && pick(body, 'lead_id') !== submissionId) validationError = 'lead_id moet gelijk zijn aan submission_id'
    else if (Number.isNaN(Date.parse(submittedAt))) validationError = 'submitted_at moet een geldige ISO-datum zijn'
    else if (source !== 'inflatietest') validationError = 'source moet inflatietest zijn'
    else if (!validateInflatietestAnswers(answers)) validationError = 'answers bevat ongeldige of onvolledige Inflatietest-antwoorden'
    else if (!isRecord(resultDetails)) validationError = 'result_details moet een JSON-object zijn'
    else if (body.consent !== true) validationError = 'consent moet true zijn'
    else if (body.vermogenstest_variant != null || body.vermogenstest_vragenset != null) validationError = 'Vermogenstest-velden moeten leeg zijn voor de Inflatietest'

    if (validationError) {
      await logWebhookCall({ supabase, email, payload_json: { ...body, _bron: bron, _origin: origin }, outcome: 'error', reden: validationError, activatielink: null, http_status: 400, submission_id: submissionId })
      return jsonError(validationError, 400)
    }

    if (!advisorOwner) {
      console.warn(`[v0] account-aanmaken: onbekende Inflatietest-adviseur "${assignedAdvisor}"; account wordt zonder ownerkoppeling verwerkt`)
    }
  }

  const variantRaw = pick(body, 'vermogenstest_variant')
  const vragensetRaw = pick(body, 'vermogenstest_vragenset')
  const vermogenstestVariant = variantRaw === 'A' || variantRaw === 'B' ? variantRaw : null
  const vermogenstestVragenset = vragensetRaw === 'oude_vragen' || vragensetRaw === 'nieuwe_vragen'
    ? vragensetRaw
    : null
  const geldigeVermogenstestKoppeling =
    (!vermogenstestVariant && !vermogenstestVragenset)
    || (vermogenstestVariant === 'A' && vermogenstestVragenset === 'oude_vragen')
    || (vermogenstestVariant === 'B' && vermogenstestVragenset === 'nieuwe_vragen')

  if (variantRaw && !vermogenstestVariant || vragensetRaw && !vermogenstestVragenset || !geldigeVermogenstestKoppeling) {
    await logWebhookCall({
      supabase,
      email,
      payload_json: { ...body, _bron: bron, _origin: origin },
      outcome: 'error',
      reden: 'ongeldige combinatie vermogenstest_variant en vermogenstest_vragenset',
      activatielink: null,
      http_status: 422,
    })
    return acceptsJson
      ? jsonError('Ongeldige combinatie vermogenstest_variant en vermogenstest_vragenset', 422)
      : new Response('Invalid vermogenstest tracking', { status: 422, headers: CORS_HEADERS })
  }

  let contactOwnerId = advisorOwner?.id ?? extractHubSpotOwnerId(body)

  // Niet elke HubSpot-workflow stuurt de owner opnieuw mee. Gebruik daarom de
  // meest recente geldige owner uit elke eerdere webhook voor hetzelfde adres.
  if (!contactOwnerId) {
    const { data: previousWebhooks, error: historyError } = await supabase
      .from('demo_invest_account_webhook_log')
      .select('payload_json')
      .ilike('email', escapeLike(email))
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100)

    if (historyError) {
      console.error('[v0] account-aanmaken: ownerhistoriek ophalen mislukt:', historyError.message)
    } else {
      for (const webhook of previousWebhooks ?? []) {
        contactOwnerId = extractHubSpotOwnerId(webhook.payload_json)
        if (contactOwnerId) break
      }
    }
  }

  const hubSpotOwner = getHubSpotOwner(contactOwnerId)
  const payloadWithOwner = {
    ...body,
    ...(contactOwnerId ? { _hubspot_owner_id: contactOwnerId } : {}),
    ...(hubSpotOwner
      ? {
          _hubspot_owner_name: hubSpotOwner.name,
          _hubspot_owner_email: hubSpotOwner.email,
          _hubspot_owner_team: hubSpotOwner.team,
        }
      : {}),
    _bron: bron,
    _origin: origin,
  }

  // ── 4. Account aanmaken of bestaand bijwerken ─────────────────────────────
  // Match op e-mailadres (case-insensitief), ONGEACHT activatiestatus. Zo maakt
  // een later binnenkomende webhook (bv. HubSpot mét de owner, nadat het
  // website-account al geactiveerd is) nooit een tweede account naast het
  // bestaande. Bij meerdere treffers kiezen we het geactiveerde account, anders
  // het meest recente, zodat de owner op het canonieke exemplaar belandt.
  const { data: matches, error: matchError } = await supabase
    .from('demo_invest_users')
    .select('id, email, activated_at, hubspot_owner_id, created_at')
    .ilike('email', escapeLike(email))
    .order('activated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (matchError) {
    console.error('[v0] account-aanmaken: lookup demo_invest_users gefaald:', matchError.message)
    await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: `DB lookup gebruiker: ${matchError.message}`, activatielink: null, http_status: 500 })
    return new Response(`Database error: ${matchError.message}`, { status: 500, headers: CORS_HEADERS })
  }

  const existing = matches?.[0] ?? null

  let userId: string
  let outcome: 'created' | 'reused'
  let existingOwnerId: string | null = null

  if (existing) {
    userId = existing.id
    outcome = 'reused'
    existingOwnerId = (existing.hubspot_owner_id as string | null)?.trim() || null
    console.log(`[v0] account-aanmaken: bestaand account hergebruikt voor ${email} (id=${userId}, geactiveerd=${Boolean(existing.activated_at)})`)
  } else {
    // Een genormaliseerd e-mailadres levert altijd hetzelfde UUID op. Daardoor
    // botsen gelijktijdige website- en HubSpot-webhooks op dezelfde primary key,
    // ook wanneer de database-index op lower(email) nog niet is uitgerold.
    const newId = await stableUserIdForEmail(email)
    const basisGebruiker = {
      id: newId,
      email,
      name,
      role: 'user',
      locale: 'nl',
      whatsapp_opt_in: false,
      created_at: new Date().toISOString(),
      activated_at: null,
    }
    let { error: insertError } = await supabase
      .from('demo_invest_users')
      .insert({
        ...basisGebruiker,
        lead_flow: leadFlow,
        vermogenstest_variant: vermogenstestVariant,
        vermogenstest_vragenset: vermogenstestVragenset,
      })

    // Houd accountaanmaak beschikbaar zolang de migratie nog niet op een oudere
    // omgeving is uitgerold. De volledige payload blijft in het webhooklog staan
    // en wordt door de migratie achteraf gebackfilld.
    if (mistVermogenstestKolom(insertError)) {
      console.warn('[v0] account-aanmaken: trackingkolommen ontbreken nog; account wordt zonder trackingkolommen aangemaakt')
      const fallbackInsert = await supabase.from('demo_invest_users').insert(basisGebruiker)
      insertError = fallbackInsert.error
    }

    if (insertError) {
      // Unieke index op lower(email): bij twee (bijna) gelijktijdige webhooks
      // voor hetzelfde adres — precies het website + HubSpot-scenario — kan deze
      // insert botsen (Postgres unique_violation, code 23505). Val dan terug op
      // het intussen aangemaakte account in plaats van te falen: zo ontstaat er
      // nooit een dubbel én gaat de owner van deze webhook niet verloren.
      if (insertError.code === '23505') {
        const { data: raced } = await supabase
          .from('demo_invest_users')
          .select('id, activated_at, hubspot_owner_id')
          .ilike('email', escapeLike(email))
          .order('activated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (raced) {
          userId = raced.id
          outcome = 'reused'
          existingOwnerId = (raced.hubspot_owner_id as string | null)?.trim() || null
          console.log(`[v0] account-aanmaken: insert-botsing opgevangen, bestaand account hergebruikt voor ${email} (id=${userId})`)
        } else {
          console.error('[v0] account-aanmaken: unique_violation maar geen bestaand account gevonden voor', email)
          await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: `DB insert gebruiker: ${insertError.message}`, activatielink: null, http_status: 500 })
          return new Response(`Database error: ${insertError.message}`, { status: 500, headers: CORS_HEADERS })
        }
      } else {
        console.error('[v0] account-aanmaken: insert demo_invest_users gefaald:', insertError.message, insertError.details)
        await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: `DB insert gebruiker: ${insertError.message}`, activatielink: null, http_status: 500 })
        return new Response(`Database error: ${insertError.message}`, { status: 500, headers: CORS_HEADERS })
      }
    } else {
      userId = newId
      outcome = 'created'
      console.log(`[v0] account-aanmaken: nieuw voorlopig account aangemaakt voor ${email} (id=${userId})`)
    }
  }

  // Bij een hergebruikte gebruiker vullen we uitsluitend lege trackingvelden
  // aan. Bestaande waarden worden nooit overschreven.
  if (outcome === 'reused' && (leadFlow || (vermogenstestVariant && vermogenstestVragenset))) {
    const { data: bestaandeTracking, error: trackingError } = await supabase
      .from('demo_invest_users')
      .select('lead_flow, vermogenstest_variant, vermogenstest_vragenset')
      .eq('id', userId)
      .maybeSingle()

    if (trackingError && !mistVermogenstestKolom(trackingError)) {
      console.error('[v0] account-aanmaken: bestaande tracking ophalen mislukt:', trackingError.message)
    } else if (bestaandeTracking) {
      const trackingUpdates: Record<string, string> = {}
      const bestaandeVariant = bestaandeTracking.vermogenstest_variant as string | null
      const bestaandeVragenset = bestaandeTracking.vermogenstest_vragenset as string | null

      if (!bestaandeTracking.lead_flow && leadFlow) trackingUpdates.lead_flow = leadFlow
      if (vermogenstestVariant && vermogenstestVragenset) {
        if (!bestaandeVariant && (!bestaandeVragenset || bestaandeVragenset === vermogenstestVragenset)) {
          trackingUpdates.vermogenstest_variant = vermogenstestVariant
        }
        if (!bestaandeVragenset && (!bestaandeVariant || bestaandeVariant === vermogenstestVariant)) {
          trackingUpdates.vermogenstest_vragenset = vermogenstestVragenset
        }
      }

      if (Object.keys(trackingUpdates).length > 0) {
        const { error: trackingUpdateError } = await supabase
          .from('demo_invest_users')
          .update(trackingUpdates)
          .eq('id', userId)
        if (trackingUpdateError) {
          console.error('[v0] account-aanmaken: lege trackingvelden aanvullen mislukt:', trackingUpdateError.message)
        }
      }
    }
  }

  // Owner alleen invullen als die nog leeg is — nooit een bestaande owner
  // overschrijven, en nooit activatie/trial/wat-dan-ook resetten. Zo kan een
  // latere HubSpot-webhook de owner alsnog aanvullen op een al geactiveerd
  // account, zonder de rest aan te raken.
  if (contactOwnerId && !existingOwnerId) {
    await updateCallUserState(supabase, userId, { contact_owner_email: contactOwnerId })
    console.log(`[v0] account-aanmaken: hubspot_owner_id gezet op ${contactOwnerId} voor ${email} (id=${userId})`)
  } else if (contactOwnerId && existingOwnerId) {
    console.log(`[v0] account-aanmaken: owner al aanwezig (${existingOwnerId}) voor ${email}, niet overschreven`)
  }

  if (isInflatietest) {
    const { data: phoneState, error: phoneLookupError } = await supabase
      .from('demo_invest_users')
      .select('phone')
      .eq('id', userId)
      .single()

    if (phoneLookupError) {
      console.error('[v0] account-aanmaken: telefoonveld ophalen mislukt:', phoneLookupError.message)
      await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: `Telefoon opslaan: ${phoneLookupError.message}`, activatielink: null, http_status: 500, user_id: userId, submission_id: submissionId })
      return jsonError('Inflatietest-inzending kon niet worden opgeslagen', 500)
    }

    if (!scalarText(phoneState.phone) && phone) {
      const { error: phoneUpdateError } = await supabase
        .from('demo_invest_users')
        .update({ phone })
        .eq('id', userId)

      if (phoneUpdateError) {
        console.error('[v0] account-aanmaken: telefoon opslaan mislukt:', phoneUpdateError.message)
        await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: `Telefoon opslaan: ${phoneUpdateError.message}`, activatielink: null, http_status: 500, user_id: userId, submission_id: submissionId })
        return jsonError('Inflatietest-inzending kon niet worden opgeslagen', 500)
      }
    }

    const submission = {
      user_id: userId,
      lead_flow: 'inflatietest',
      source: 'inflatietest',
      submission_id: submissionId,
      submitted_at: new Date(submittedAt).toISOString(),
      assigned_advisor: assignedAdvisor,
      answers,
      result,
      result_details: resultDetails,
    }
    const { error: submissionError } = await supabase
      .from('inflatietest_submissions')
      .insert(submission)

    if (submissionError?.code === '23505') {
      const { data: existingSubmission, error: existingSubmissionError } = await supabase
        .from('inflatietest_submissions')
        .select('user_id')
        .eq('submission_id', submissionId)
        .single()

      if (existingSubmissionError || existingSubmission?.user_id !== userId) {
        console.error('[v0] account-aanmaken: submission_id hoort bij een andere of onleesbare inzending', existingSubmissionError)
        await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: 'submission_id is al aan een andere inzending gekoppeld', activatielink: null, http_status: 409, user_id: userId, submission_id: submissionId })
        return jsonError('submission_id is al in gebruik', 409)
      }
      outcome = 'reused'
    } else if (submissionError) {
      console.error('[v0] account-aanmaken: Inflatietest-inzending opslaan mislukt:', submissionError.message)
      await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: `Inflatietest opslaan: ${submissionError.message}`, activatielink: null, http_status: 500, user_id: userId, submission_id: submissionId })
      return jsonError('Inflatietest-inzending kon niet worden opgeslagen', 500)
    }
  }

  // ── 5. Invite ophalen of aanmaken (nooit twee actieve invites per user) ────
  //
  // Strategie:
  //   a) Kijk of er al een ongebruikte invite is (used_at IS NULL, raw_token
  //      aanwezig). Zo ja: hergebruik die exact. Activatielinks verlopen niet
  //      meer, dus expires_at speelt hier geen rol — ook oude invites die ooit
  //      met 48 uur geldigheid zijn aangemaakt blijven bruikbaar.
  //   b) Zo niet: genereer een nieuwe token, sla raw_token op, verwijder
  //      eerder gebruikte invites van deze user.
  //
  // Dit garandeert dat Lovable en HubSpot altijd dezelfde link terugkrijgen.

  const { data: existingInvite } = await supabase
    .from('demo_invest_invites')
    .select('raw_token')
    .eq('user_id', userId)
    .is('used_at', null)
    .not('raw_token', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let rawToken: string

  if (existingInvite?.raw_token) {
    // Bestaande invite hergebruiken — zelfde link voor Lovable én HubSpot
    rawToken = existingInvite.raw_token
    console.log(`[v0] account-aanmaken: bestaande invite hergebruikt voor ${email} (onbeperkt geldig)`)
  } else {
    // Geen ongebruikte invite meer — maak een nieuwe aan
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    rawToken = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const tokenHash = await sha256hex(rawToken)
    // expires_at is NOT NULL in het schema; zet hem praktisch oneindig zodat
    // niets in de keten de link nog als verlopen kan lezen.
    const expiresAt = new Date('2999-12-31T23:59:59.000Z').toISOString()

    // Verwijder al-gebruikte invites zodat er nooit rommel overblijft
    await supabase
      .from('demo_invest_invites')
      .delete()
      .eq('user_id', userId)
      .not('used_at', 'is', null)

    const { error: inviteError } = await supabase
      .from('demo_invest_invites')
      .insert({
        user_id: userId,
        email,
        token_hash: tokenHash,
        raw_token: rawToken,
        expires_at: expiresAt,
      })

    if (inviteError) {
      console.error('[v0] account-aanmaken: insert demo_invest_invites gefaald:', inviteError.message)
      await logWebhookCall({ supabase, email, payload_json: payloadWithOwner, outcome: 'error', reden: `DB insert invite: ${inviteError.message}`, activatielink: null, http_status: 500 })
      return new Response(`Database error: ${inviteError.message}`, { status: 500, headers: CORS_HEADERS })
    }
    console.log(`[v0] account-aanmaken: nieuwe invite aangemaakt voor ${email}`)
  }

  if (outcome === 'created') {
    const { data: createdUser } = await supabase
      .from('demo_invest_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (createdUser) {
      await emitEvent({
        type: 'trial.account_created',
        user: createdUser as DemoUser,
        data: { stage: 'account_created', source: source || bron },
      })
    }
  }

  const { data: timelineUser } = await supabase.from('demo_invest_users').select('*').eq('id', userId).single()
  if (timelineUser) await scheduleLeadTimeline(supabase, timelineUser as DemoUser)

  // ── 6. Activatielink bouwen ───────────────────────────────────────────────
  const activatieLink = activationLink(rawToken)

  // ── 7. Log succes ─────────────────────────────────────────────────────────
  await logWebhookCall({
    supabase,
    email,
    payload_json: payloadWithOwner,
    outcome,
    reden: null,
    activatielink: activatieLink,
    http_status: 200,
    user_id: isInflatietest ? userId : null,
    submission_id: isInflatietest ? submissionId : null,
  })
  console.log('[v0] account-aanmaken: succes', { email, userId, outcome, bron, activatieLink })

  // ── 8. Stuur activatielink terug ──────────────────────────────────────────
  // Websites (Lovable) sturen Accept: application/json → JSON-antwoord.
  // HubSpot-webhook verwacht plain tekst → behoud backward compat.
  if (acceptsJson || isInflatietest) {
    return new Response(
      JSON.stringify({
        ok: true,
        outcome,
        activatielink: activatieLink,
        user_id: userId,
        ...(isInflatietest ? { submission_id: submissionId } : {}),
        email,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
      }
    )
  }

  // Plain-text fallback for HubSpot (no Accept: application/json)
  return new Response(activatieLink, {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

// POST /api/account-aanmaken
export async function POST(req: NextRequest) {
  return handleWebhook(req)
}
