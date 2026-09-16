import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { buildAccountSourceByEmail, classifyAccountSource } from '@/lib/account-source'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllCallUserStates, getBookingLinks } from '@/lib/call-booking-data'

const BATCH_SIZE = 1000
const SENSITIVE_PAYLOAD_KEY = /secret|password|authorization|api[_-]?key|token/i

function sanitizeWebhookPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeWebhookPayload)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      key === 'raw_body'
        ? '[ruwe body beveiligd opgeslagen]'
        : SENSITIVE_PAYLOAD_KEY.test(key)
          ? '[verborgen]'
          : sanitizeWebhookPayload(nestedValue),
    ]),
  )
}

async function fetchAllRows<T>(
  fetchBatch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await fetchBatch(from, from + BATCH_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < BATCH_SIZE) break
  }
  return rows
}

/**
 * GET /api/admin/data
 * Geeft alle gegevens voor het admin-dashboard terug.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()

  try {
    const [{ count, error: countError }, usersData, allAccountLogs] = await Promise.all([
      supabase.from('demo_invest_users').select('id', { count: 'exact', head: true }),
      fetchAllRows<Record<string, unknown>>((from, to) => supabase
        .from('demo_invest_users')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)),
      fetchAllRows<{
        id: string
        created_at: string
        email: string | null
        payload_json: Record<string, unknown>
        outcome: string
        reden: string | null
        activatielink: string | null
        http_status: number
      }>((from, to) => supabase
        .from('demo_invest_account_webhook_log')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)),
    ])

    if (countError) throw countError

    const [
      { data: funnelsData },
      { data: logsData },
      { data: triggerData },
      { data: configData },
      { data: invitesData },
      { data: quizData },
      { data: followUpDisabledData },
      callStates,
      bookingLinks,
    ] = await Promise.all([
      supabase.from('demo_invest_user_funnel').select('*'),
      supabase.from('demo_invest_webhook_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('demo_invest_trigger_log').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('demo_invest_webhook_config').select('*').order('trigger_naam'),
      supabase.from('demo_invest_invites').select('user_id, expires_at, used_at'),
      supabase.from('demo_invest_quiz_submissions').select('*'),
      supabase.from('demo_invest_trigger_sent').select('user_id').eq('workflow_naam', '__automatische_opvolging_uit__'),
      getAllCallUserStates(supabase),
      getBookingLinks(supabase),
    ])

    const accountLogs = allAccountLogs.map(log => ({
      ...log,
      payload_json: sanitizeWebhookPayload(log.payload_json ?? {}) as Record<string, unknown>,
      instroom: classifyAccountSource(log.payload_json ?? {}),
    }))
    const sourceByEmail = buildAccountSourceByEmail(accountLogs)
    const latestAccountWebhooks = {
      discovery: accountLogs.find(log => log.instroom === 'discovery') ?? null,
      vermogenstest: accountLogs.find(log => log.instroom === 'vermogenstest') ?? null,
    }

    const ownerNameById = new Map(
      bookingLinks
        .filter(link => link.actief && !link.is_default)
        .map(link => [link.owner_email.trim(), link.naam]),
    )
    const followUpDisabledUserIds = new Set((followUpDisabledData ?? []).map(row => row.user_id))
    const users = usersData.map(user => {
      const id = String(user.id)
      const email = String(user.email ?? '').trim().toLowerCase()
      const callState = callStates.get(id)
      const ownerId = callState?.contact_owner_email?.trim() || null

      return {
        ...user,
        ...callState,
        instroom: sourceByEmail.get(email) ?? null,
        hubspot_owner_id: ownerId,
        owner_name: ownerId ? ownerNameById.get(ownerId) ?? null : null,
        opvolging_actief: !followUpDisabledUserIds.has(id),
      }
    })

    return NextResponse.json({
      users,
      accountTotal: count ?? users.length,
      funnels: funnelsData ?? [],
      logs: logsData ?? [],
      triggerLogs: triggerData ?? [],
      webhookConfig: configData ?? [],
      accountLogs: accountLogs.slice(0, 300),
      latestAccountWebhooks,
      invites: invitesData ?? [],
      quizSubmissions: quizData ?? [],
    })
  } catch (error) {
    console.error('[admin/data] Admin-gegevens ophalen mislukt:', error)
    return NextResponse.json({ error: 'De admin-gegevens konden niet worden opgehaald.' }, { status: 500 })
  }
}
