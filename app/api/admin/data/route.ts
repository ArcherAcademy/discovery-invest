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
    { data: leadSubmissionsData, error: leadSubmissionsError },
  ] = await Promise.all([
    supabase.from('demo_invest_user_funnel').select('*'),
    supabase.from('demo_invest_webhook_log').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('demo_invest_trigger_log').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('demo_invest_webhook_config').select('*').order('trigger_naam'),
    supabase.from('demo_invest_account_webhook_log').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('demo_invest_quiz_submissions').select('*'),
    supabase.from('demo_invest_trigger_sent').select('user_id').eq('workflow_naam', '__automatische_opvolging_uit__'),
    supabase.from('demo_invest_boekingslinks').select('hubspot_owner_id, naam'),
    supabase
      .from('lead_submissions')
      .select('id, user_id, submission_id, lead_flow, source, variant, vragenset, assigned_advisor, answers_labeled, answers_raw, result, result_details, score, extra, utm_source, utm_campaign, submitted_at, created_at')
      .order('submitted_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5000),
  ])

  // Ontbrekende tabel of kolom: terugvallen op de payloads in het webhooklog.
  const leadSubmissionsTableMissing = ['PGRST205', '42P01', '42703', 'PGRST204'].includes(leadSubmissionsError?.code ?? '')
  if (leadSubmissionsError && !leadSubmissionsTableMissing) {
    console.error('[admin/data] Leadinzendingen ophalen mislukt:', leadSubmissionsError)
    return NextResponse.json({ error: 'De leadinzendingen konden niet worden opgehaald.' }, { status: 500 })
  }

  const usersData = usersResult.rows
  const callStates = await getAllCallUserStates(supabase)

  // Instroom is de eerste herkenbare ingang van een account. Classificeer alleen
  // expliciete signalen; een ontbrekende bron als "Discovery" tonen zou de
  // marketingcijfers kunstmatig verbeteren. Oudere logs blijven bruikbaar doordat
  // we de volledige tabel chronologisch en in stabiele batches lezen.
  type Instroom = 'inflatietest' | 'eenprocenttest' | 'vermogenstest' | 'discovery' | 'onbekend'
  type VermogenstestTracking = {
    lead_flow: string | null
    vermogenstest_variant: 'A' | 'B' | null
    vermogenstest_vragenset: 'oude_vragen' | 'nieuwe_vragen' | null
  }
  type LeadSubmissionRow = {
    id: string
    user_id: string
    submission_id: string
    lead_flow: string
    source: string
    variant: 'A' | 'B' | null
    vragenset: 'oude_vragen' | 'nieuwe_vragen' | null
    assigned_advisor: string | null
    answers_labeled: Array<{ question_id: string; question: string; answer: string; value: unknown }>
    answers_raw: Record<string, unknown> | unknown[]
    result: string | null
    result_details: Record<string, unknown>
    score: number | null
    extra: Record<string, unknown>
    utm_source: string | null
    utm_campaign: string | null
    submitted_at: string
    created_at: string
  }

  const EXTRA_KEYS = ['path', 'age_class', 'situation', 'building_blocks', 'building_blocks_total', 'missing_points', 'strengths', 'layer', 'wealth_band', 'segment', 'page_uri']

  const instroomByEmail = new Map<string, Exclude<Instroom, 'onbekend'>>()
  const trackingByEmail = new Map<string, VermogenstestTracking>()
  const historicalOwnerByEmail = new Map<string, string>()
  const fallbackSubmissionsById = new Map<string, LeadSubmissionRow>()
  const phoneFromSubmissionByEmail = new Map<string, string>()
  const userByEmail = new Map(usersResult.rows.map(user => [(user.email ?? '').trim().toLowerCase(), user]))

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

  const toInstroom = (flow: string | null | undefined): Exclude<Instroom, 'onbekend'> | null => {
  const value = (flow ?? '').trim().toLowerCase()
  if (value === 'inflatietest' || value === 'inflatie-test') return 'inflatietest'
  if (value === 'eenprocenttest' || value === '1%-test' || value === '1-procent-test') return 'eenprocenttest'
  if (value === 'vermogenstest' || value === 'vermogens-test') return 'vermogenstest'
  if (value === 'demo' || value === 'discovery') return 'discovery'
  return null
  }

  const classifyInstroom = (payload: Record<string, unknown>): Exclude<Instroom, 'onbekend'> | null => {
  const signal = [
  payloadValue(payload, 'lead_flow'),
  payloadValue(payload, 'page_uri'),
      payloadValue(payload, 'source', 'hs_lead_source', 'hs_source_form_submission'),
    ].join(' ').toLowerCase()

    if (signal.includes('inflatie-test') || signal.includes('inflatietest')) return 'inflatietest'
    if (signal.includes('eenprocenttest') || signal.includes('1%-test') || signal.includes('1-procent-test')) return 'eenprocenttest'
    if (signal.includes('vermogens-test') || signal.includes('vermogenstest')) return 'vermogenstest'
    if (signal.includes('/demo') || signal.includes('discovery')) return 'discovery'
    return null
  }

  const normalizeAnswers = (flow: string, payload: Record<string, unknown>) => {
    if (flow !== 'demo' && Array.isArray(payload.answers_labeled)) return payload.answers_labeled
    if (flow === 'vermogenstest' && Array.isArray(payload.answers)) return payload.answers
    if (flow === 'demo' && payload.discovery_answers && typeof payload.discovery_answers === 'object' && !Array.isArray(payload.discovery_answers)) {
      return Object.entries(payload.discovery_answers as Record<string, unknown>)
        .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[1]) && typeof entry[1] === 'object' && !Array.isArray(entry[1]))
        .map(([questionId, answer]) => ({
          question_id: questionId,
          question: scalarText(answer.question) || questionId,
          answer: scalarText(answer.answer),
          value: answer.answer_value ?? answer.value ?? answer.answer ?? null,
        }))
    }
    return []
  }

  {
    const batch = 1000
    for (let from = 0; ; from += batch) {
      const { data, error } = await supabase
        .from('demo_invest_account_webhook_log')
        .select('id, email, payload_json, outcome, created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + batch - 1)
      if (error) {
        console.error('[admin/data] instroom-classificatie mislukt:', error)
        break
      }
      for (const row of (data ?? []) as { id: string; email: string | null; payload_json: Record<string, unknown> | null; outcome: string | null; created_at: string }[]) {
        const payload = row.payload_json ?? {}
        const email = (row.email ?? payloadValue(payload, 'email', 'contact_email', 'hs_associated_contact_email')).trim().toLowerCase()
        if (!email) continue

        const submissionPhone = payloadValue(payload, 'phone', 'telefoon', 'hs_phone')
        if (submissionPhone && !phoneFromSubmissionByEmail.has(email)) phoneFromSubmissionByEmail.set(email, submissionPhone)

        if (row.outcome === 'created' || row.outcome === 'reused') {
          const submissionId = payloadValue(payload, 'submission_id')
          const user = userByEmail.get(email)
          if (submissionId && user && !fallbackSubmissionsById.has(submissionId)) {
            const rawFlow = (payloadValue(payload, 'lead_flow') || payloadValue(payload, 'source')).toLowerCase()
            const flow = rawFlow === 'discovery' ? 'demo' : ['vermogenstest', 'demo', 'inflatietest', 'eenprocenttest'].includes(rawFlow) ? rawFlow : 'onbekend'
            const extra: Record<string, unknown> = {}
            for (const key of EXTRA_KEYS) {
              if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') extra[key] = payload[key]
            }
            const rawAnswers = flow === 'demo' ? payload.discovery_answers : payload.answers
            const resultDetails = payload.result_details && typeof payload.result_details === 'object' && !Array.isArray(payload.result_details)
              ? payload.result_details as Record<string, unknown>
              : {}
            const scoreValue = Number(payload.score)
            const submittedAt = payloadValue(payload, 'submitted_at')
            fallbackSubmissionsById.set(submissionId, {
              id: `webhook-${row.id}`,
              user_id: user.id,
              submission_id: submissionId,
              lead_flow: flow,
              source: flow === 'vermogenstest' ? 'Vermogenstest' : flow === 'demo' ? 'Discovery-aanvraag' : flow === 'inflatietest' ? 'Inflatietest' : flow === 'eenprocenttest' ? '1%-test' : 'onbekend',
              extra,
              variant: payload.vermogenstest_variant === 'A' || payload.vermogenstest_variant === 'B' ? payload.vermogenstest_variant : null,
              vragenset: payload.vermogenstest_vragenset === 'oude_vragen' || payload.vermogenstest_vragenset === 'nieuwe_vragen' ? payload.vermogenstest_vragenset : null,
              assigned_advisor: payloadValue(payload, 'assigned_advisor') || null,
              answers_labeled: normalizeAnswers(flow, payload) as LeadSubmissionRow['answers_labeled'],
              answers_raw: rawAnswers && typeof rawAnswers === 'object' ? rawAnswers as Record<string, unknown> | unknown[] : {},
              result: payloadValue(payload, 'result') || null,
              result_details: resultDetails,
              score: Number.isFinite(scoreValue) ? scoreValue : null,
              utm_source: payloadValue(payload, 'utm_source') || null,
              utm_campaign: payloadValue(payload, 'utm_campaign') || null,
              submitted_at: submittedAt && !Number.isNaN(Date.parse(submittedAt)) ? new Date(submittedAt).toISOString() : row.created_at,
              created_at: row.created_at,
            })
          }
        }

        const ownerId = extractHubSpotOwnerId(payload)
        if (ownerId) historicalOwnerByEmail.set(email, ownerId)

        if (row.outcome === 'created' || row.outcome === 'reused') {
          if (!instroomByEmail.has(email)) {
            const instroom = classifyInstroom(payload)
            if (instroom) instroomByEmail.set(email, instroom)
          }

          const leadFlow = payloadValue(payload, 'lead_flow') || null
          const variantRaw = payloadValue(payload, 'vermogenstest_variant')
          const vragensetRaw = payloadValue(payload, 'vermogenstest_vragenset')
          const vermogenstestVariant = variantRaw === 'A' || variantRaw === 'B' ? variantRaw : null
          const vermogenstestVragenset = vragensetRaw === 'oude_vragen' || vragensetRaw === 'nieuwe_vragen'
            ? vragensetRaw
            : null
          const geldigeKoppeling =
            (vermogenstestVariant === 'A' && vermogenstestVragenset === 'oude_vragen')
            || (vermogenstestVariant === 'B' && vermogenstestVragenset === 'nieuwe_vragen')

          if (leadFlow || geldigeKoppeling) {
            const bestaand = trackingByEmail.get(email)
            trackingByEmail.set(email, {
              lead_flow: leadFlow ?? bestaand?.lead_flow ?? null,
              vermogenstest_variant: geldigeKoppeling ? vermogenstestVariant : bestaand?.vermogenstest_variant ?? null,
              vermogenstest_vragenset: geldigeKoppeling ? vermogenstestVragenset : bestaand?.vermogenstest_vragenset ?? null,
            })
          }
        }
      }
      if (!data || data.length < batch) break
    }
  }

  // HubSpot is de source of truth voor zowel de actuele contact-owner als de naam.
  // Bij een tijdelijke API-fout blijven de opgeslagen owner en webhookhistoriek beschikbaar.
  let liveOwnerIdByEmail = new Map<string, string | null>()
  let livePhoneByEmail = new Map<string, string | null>()
  let liveOwnersById = new Map<string, { name: string }>()
  try {
    const snapshot = await getHubSpotAccountOwnerSnapshot(
      usersData.map(user => (user.email ?? '').trim()).filter(Boolean),
    )
    liveOwnerIdByEmail = snapshot.ownerIdByEmail
    livePhoneByEmail = snapshot.phoneByEmail
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

  const resolvedLeadSubmissions = leadSubmissionsTableMissing
    ? [...fallbackSubmissionsById.values()].sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at))
    : (leadSubmissionsData ?? []) as LeadSubmissionRow[]
  const followUpDisabledUserIds = new Set((followUpDisabledData ?? []).map(row => row.user_id))
  const latestSubmissionByUser = new Map<string, LeadSubmissionRow>()
  for (const submission of resolvedLeadSubmissions) {
    if (!latestSubmissionByUser.has(submission.user_id)) latestSubmissionByUser.set(submission.user_id, submission)
  }
  const users = (usersData ?? []).map(user => {
    const callState = callStates.get(user.id)
    const email = (user.email ?? '').trim().toLowerCase()
    const storedOwnerId = ((callState?.contact_owner_email ?? user.hubspot_owner_id) as string | null | undefined)?.trim()
    const fallbackOwnerId = storedOwnerId || historicalOwnerByEmail.get(email) || null
    const ownerId = liveOwnerIdByEmail.has(email) ? liveOwnerIdByEmail.get(email) ?? null : fallbackOwnerId
    const tracking = trackingByEmail.get(email)
    const latestSubmission = latestSubmissionByUser.get(user.id)

    return {
      ...user,
      ...callState,
      lead_flow: latestSubmission?.lead_flow ?? user.lead_flow ?? tracking?.lead_flow ?? null,
      vermogenstest_variant: latestSubmission?.variant ?? user.vermogenstest_variant ?? tracking?.vermogenstest_variant ?? null,
      vermogenstest_vragenset: latestSubmission?.vragenset ?? user.vermogenstest_vragenset ?? tracking?.vermogenstest_vragenset ?? null,
      hubspot_owner_id: ownerId,
      phone: livePhoneByEmail.get(email) ?? user.phone ?? phoneFromSubmissionByEmail.get(email) ?? null,
      opvolging_actief: !followUpDisabledUserIds.has(user.id),
      // Een onherkenbare lead_flow (bv. "onbekend" of "evergreen") mag een
      // expliciet inflatietest-, vermogenstest- of discoverysignaal niet overschrijven.
      instroom: toInstroom(latestSubmission?.lead_flow)
        ?? toInstroom(user.lead_flow)
        ?? toInstroom(tracking?.lead_flow)
        ?? instroomByEmail.get(email)
        ?? 'onbekend',
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
    leadSubmissions: resolvedLeadSubmissions,
    bookingOwners: ownerNames,
  })
}
