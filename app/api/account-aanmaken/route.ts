import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateCallUserState } from '@/lib/call-booking-data'
import { emitEvent } from '@/lib/emit-event'
import type { DemoUser } from '@/lib/types'
import { getHubSpotOwner } from '@/lib/hubspot-owners'

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

// ── DB log helper (nooit blocking, nooit fatal) ───────────────────────────────
async function logWebhookCall(opts: {
  supabase: ReturnType<typeof createAdminClient>
  email: string | null
  payload_json: Record<string, unknown>
  outcome: 'created' | 'reused' | 'error'
  reden: string | null
  activatielink: string | null
  http_status: number
}) {
  try {
    await opts.supabase.from('demo_invest_account_webhook_log').insert({
      email: opts.email,
      payload_json: opts.payload_json,
      outcome: opts.outcome,
      reden: opts.reden,
      activatielink: opts.activatielink,
      http_status: opts.http_status,
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
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS })
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
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  // ── 3. Velden extraheren ──────────────────────────────────────────────────
  const email = emailRaw
  if (!email) {
    console.warn('[v0] account-aanmaken: geen e-mailadres in payload', body)
    await logWebhookCall({ supabase, email: null, payload_json: { ...body, _bron: bron, _origin: origin }, outcome: 'error', reden: 'geen e-mailadres in payload', activatielink: null, http_status: 422 })
    return new Response('Missing email', { status: 422, headers: CORS_HEADERS })
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
  const contactOwnerCandidate = pick(
    body,
    'hubspot_owner_id',
    'contact_owner_id',
    'owner_id',
    'contacteigenaar_id',
  )
  // Een HubSpot owner-ID is numeriek. Gelijknamige marketingvelden zoals
  // `contactowner` bevatten antwoorden als "Social media" en zijn géén owner.
  const contactOwnerId = /^\d+$/.test(contactOwnerCandidate) ? contactOwnerCandidate : null
  const hubSpotOwner = getHubSpotOwner(contactOwnerId)
  const payloadWithOwner = {
    ...body,
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
    const newId = crypto.randomUUID()
    const { error: insertError } = await supabase
      .from('demo_invest_users')
      .insert({
        id: newId,
        email,
        name,
        role: 'user',
        locale: 'nl',
        whatsapp_opt_in: false,
        created_at: new Date().toISOString(),
        activated_at: null,
      })

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
        data: { stage: 'account_created', source: bron },
      })
    }
  }

  // ── 6. Activatielink bouwen ───────────────────────────────────────────────
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const activatieLink = `${appUrl.replace(/\/$/, '')}/activeren?token=${rawToken}`

  // ── 7. Log succes ─────────────────────────────────────────────────────────
  await logWebhookCall({
    supabase,
    email,
    payload_json: payloadWithOwner,
    outcome,
    reden: null,
    activatielink: activatieLink,
    http_status: 200,
  })
  console.log('[v0] account-aanmaken: succes', { email, userId, outcome, bron, activatieLink })

  // ── 8. Stuur activatielink terug ──────────────────────────────────────────
  // Websites (Lovable) sturen Accept: application/json → JSON-antwoord.
  // HubSpot-webhook verwacht plain tekst → behoud backward compat.
  if (acceptsJson) {
    return new Response(
      JSON.stringify({ ok: true, activatielink: activatieLink, email, outcome }),
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
