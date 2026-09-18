import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllCallUserStates } from '@/lib/call-booking-data'

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
    { data: invitesData },
    { data: quizData },
    { data: followUpDisabledData },
    { data: bookingLinksData },
  ] = await Promise.all([
    supabase.from('demo_invest_user_funnel').select('*'),
    supabase.from('demo_invest_webhook_log').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('demo_invest_trigger_log').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('demo_invest_webhook_config').select('*').order('trigger_naam'),
    supabase.from('demo_invest_account_webhook_log').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('demo_invest_invites').select('user_id, expires_at, used_at'),
    supabase.from('demo_invest_quiz_submissions').select('*'),
    supabase.from('demo_invest_trigger_sent').select('user_id').eq('workflow_naam', '__automatische_opvolging_uit__'),
    supabase.from('demo_invest_boekingslinks').select('hubspot_owner_id, naam'),
  ])

  const usersData = usersResult.rows
  const callStates = await getAllCallUserStates(supabase)

  // Instroom / herkomst van het account bepalen uit de account-aanmaken webhook:
  // wie ooit via de vermogenstest-pagina binnenkwam (page_uri bevat
  // "vermogens-test") telt als 'Vermogenstest', al de rest als 'Discovery'.
  // We lezen de volledige account-webhooklog in batches (niet de 300-limiet van
  // accountLogsData hierboven) zodat elk account correct geclassificeerd wordt,
  // en matchen op e-mailadres omdat de log geen user_id bevat.
  const vermogenstestEmails = new Set<string>()
  {
    const batch = 1000
    for (let from = 0; ; from += batch) {
      const { data, error } = await supabase
        .from('demo_invest_account_webhook_log')
        .select('email, page_uri:payload_json->>page_uri')
        .range(from, from + batch - 1)
      if (error) {
        console.error('[admin/data] instroom-classificatie mislukt:', error)
        break
      }
      for (const row of (data ?? []) as { email: string | null; page_uri: string | null }[]) {
        const email = (row.email ?? '').toLowerCase()
        const uri = (row.page_uri ?? '').toLowerCase()
        if (email && (uri.includes('vermogens-test') || uri.includes('vermogenstest'))) {
          vermogenstestEmails.add(email)
        }
      }
      if (!data || data.length < batch) break
    }
  }

  // Map van HubSpot owner-id → accountmanagernaam, uit de boekingslinks.
  const ownerNames: Record<string, string> = {}
  for (const row of (bookingLinksData ?? []) as { hubspot_owner_id: string | null; naam: string | null }[]) {
    const id = (row.hubspot_owner_id ?? '').trim()
    if (id && row.naam) ownerNames[id] = row.naam
  }

  const followUpDisabledUserIds = new Set((followUpDisabledData ?? []).map(row => row.user_id))
  const users = (usersData ?? []).map(user => ({
    ...user,
    ...callStates.get(user.id),
    opvolging_actief: !followUpDisabledUserIds.has(user.id),
    instroom: vermogenstestEmails.has((user.email ?? '').toLowerCase()) ? 'vermogenstest' : 'discovery',
  }))

  return NextResponse.json({
    users,
    accountTotal: usersResult.count,
    funnels: funnelsData ?? [],
    logs: logsData ?? [],
    triggerLogs: triggerData ?? [],
    webhookConfig: configData ?? [],
    accountLogs: accountLogsData ?? [],
    invites: invitesData ?? [],
    quizSubmissions: quizData ?? [],
    bookingOwners: ownerNames,
  })
}
