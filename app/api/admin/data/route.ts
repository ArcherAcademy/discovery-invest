import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllCallUserStates } from '@/lib/call-booking-data'
import { extractHubSpotOwnerId, getHubSpotAccountOwnerSnapshot } from '@/lib/hubspot-owners'

/**
 * GET /api/admin/data
 * Returns all admin dashboard data. Requires an active admin session.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()

  const accountBatchSize = 1000

  async function fetchAllUsers() {
    const { count, error: countError } = await supabase
      .from('demo_invest_users')
      .select('id', { count: 'exact', head: true })

    if (countError) throw countError

    const rows = []
    for (let from = 0; from < (count ?? 0); from += accountBatchSize) {
      const { data, error } = await supabase
        .from('demo_invest_users')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + accountBatchSize - 1)

      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < accountBatchSize) break
    }

    return { rows, count: count ?? rows.length }
  }

  let usersResult
  try {
    usersResult = await fetchAllUsers()
  } catch (error) {
    console.error('[admin/data] Volledige accountlijst ophalen mislukt:', error)
    return NextResponse.json({ error: 'De volledige accountlijst kon niet worden opgehaald.' }, { status: 500 })
  }

  const [
    { data: funnelsData },
    { data: logsData },
    { data: triggerData },
    { data: configData },
    { data: accountLogsData },
    { data: quizData },
    { data: followUpDisabledData },
    { data: bookingLinksData },
  ] = await Promise.all([
    supabase.from('demo_invest_user_funnel').select('*'),
    supabase.from('demo_invest_webhook_log').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('demo_invest_trigger_log').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('demo_invest_webhook_config').select('*').order('trigger_naam'),
    supabase.from('demo_invest_account_webhook_log').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('demo_invest_quiz_submissions').select('*'),
    supabase.from('demo_invest_trigger_sent').select('user_id').eq('workflow_naam', '__automatische_opvolging_uit__'),
    supabase.from('demo_invest_boekingslinks').select('hubspot_owner_id, naam'),
  ])

  const usersData = usersResult.rows
  const callStates = await getAllCallUserStates(supabase)

  // Instroom is de eerste herkenbare ingang van een account. Classificeer alleen
  // expliciete signalen; een ontbrekende bron als "Discovery" tonen zou de
  // marketingcijfers kunstmatig verbeteren. Oudere logs blijven bruikbaar doordat
  // we de volledige tabel chronologisch en in stabiele batches lezen.
  type Instroom = 'vermogenstest' | 'discovery' | 'onbekend'
  const instroomByEmail = new Map<string, Exclude<Instroom, 'onbekend'>>()
  const historicalOwnerByEmail = new Map<string, string>()

  const scalarText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
      return scalarText((value as { value?: unknown }).value)
    }
    return ''
  }

  const payloadValue = (payload: Record<string, unknown>, ...keys: string[]): string => {
    const properties = payload.properties && typeof payload.properties === 'object' && !Array.isArray(payload.properties)
      ? payload.properties as Record<string, unknown>
      : null
    for (const source of [payload, properties]) {
      if (!source) continue
      for (const key of keys) {
        const value = scalarText(source[key])
        if (value) return value
      }
    }
    return ''
  }

  const classifyInstroom = (payload: Record<string, unknown>): Exclude<Instroom, 'onbekend'> | null => {
    const signal = [
      payloadValue(payload, 'page_uri'),
      payloadValue(payload, 'source', 'hs_lead_source', 'hs_source_form_submission'),
    ].join(' ').toLowerCase()

    if (signal.includes('vermogens-test') || signal.includes('vermogenstest')) return 'vermogenstest'
    if (signal.includes('/demo') || signal.includes('discovery')) return 'discovery'
    return null
  }

  {
    const batch = 1000
    for (let from = 0; ; from += batch) {
      const { data, error } = await supabase
        .from('demo_invest_account_webhook_log')
        .select('email, payload_json, outcome')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + batch - 1)
      if (error) {
        console.error('[admin/data] instroom-classificatie mislukt:', error)
        break
      }
      for (const row of (data ?? []) as { email: string | null; payload_json: Record<string, unknown> | null; outcome: string | null }[]) {
        const payload = row.payload_json ?? {}
        const email = (row.email ?? payloadValue(payload, 'email', 'contact_email', 'hs_associated_contact_email')).trim().toLowerCase()
        if (!email) continue

        const ownerId = extractHubSpotOwnerId(payload)
        if (ownerId) historicalOwnerByEmail.set(email, ownerId)

        if (!instroomByEmail.has(email) && (row.outcome === 'created' || row.outcome === 'reused')) {
          const instroom = classifyInstroom(payload)
          if (instroom) instroomByEmail.set(email, instroom)
        }
      }
      if (!data || data.length < batch) break
    }
  }

  // HubSpot is de source of truth voor zowel de actuele contact-owner als de naam.
  // Bij een tijdelijke API-fout blijven de opgeslagen owner en webhookhistoriek beschikbaar.
  let liveOwnerIdByEmail = new Map<string, string | null>()
  let liveOwnersById = new Map<string, { name: string }>()
  try {
    const snapshot = await getHubSpotAccountOwnerSnapshot(
      usersData.map(user => (user.email ?? '').trim()).filter(Boolean),
    )
    liveOwnerIdByEmail = snapshot.ownerIdByEmail
    liveOwnersById = snapshot.ownersById
  } catch (error) {
    console.error('[admin/data] Actuele HubSpot owners ophalen mislukt; lokale fallback wordt gebruikt:', error)
  }

  const ownerNames: Record<string, string> = {}
  for (const row of (bookingLinksData ?? []) as { hubspot_owner_id: string | null; naam: string | null }[]) {
    const id = (row.hubspot_owner_id ?? '').trim()
    if (id && row.naam) ownerNames[id] = row.naam
  }
  for (const [id, owner] of liveOwnersById) ownerNames[id] = owner.name

  const followUpDisabledUserIds = new Set((followUpDisabledData ?? []).map(row => row.user_id))
  const users = (usersData ?? []).map(user => {
    const callState = callStates.get(user.id)
    const email = (user.email ?? '').trim().toLowerCase()
    const storedOwnerId = ((callState?.contact_owner_email ?? user.hubspot_owner_id) as string | null | undefined)?.trim()
    const fallbackOwnerId = storedOwnerId || historicalOwnerByEmail.get(email) || null
    const ownerId = liveOwnerIdByEmail.has(email) ? liveOwnerIdByEmail.get(email) ?? null : fallbackOwnerId

    return {
      ...user,
      ...callState,
      hubspot_owner_id: ownerId,
      opvolging_actief: !followUpDisabledUserIds.has(user.id),
      instroom: instroomByEmail.get(email) ?? 'onbekend',
    }
  })

  return NextResponse.json({
    users,
    accountTotal: usersResult.count,
    funnels: funnelsData ?? [],
    logs: logsData ?? [],
    triggerLogs: triggerData ?? [],
    webhookConfig: configData ?? [],
    accountLogs: accountLogsData ?? [],
    quizSubmissions: quizData ?? [],
    bookingOwners: ownerNames,
  })
}
