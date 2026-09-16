import { NextRequest, NextResponse } from 'next/server'
import { utils, write } from 'xlsx'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermanentAccess } from '@/lib/access'
import { buildAccountSourceByEmail } from '@/lib/account-source'
import { getAllCallUserStates, getBookingLinks } from '@/lib/call-booking-data'

export const runtime = 'nodejs'

type ExportUser = {
  id: string
  name: string | null
  email: string
  role: 'user' | 'admin' | 'mentor'
  locale: string | null
  whatsapp_opt_in: boolean | null
  created_at: string
  activated_at: string | null
  trial_started_at: string | null
  trial_expires_at: string | null
  last_activity_at: string | null
  instroom?: 'vermogenstest' | 'discovery' | null
}

type ExportFunnel = {
  user_id: string
  videos_completed_count: number | null
  all_completed_at: string | null
  event_booked: boolean | null
  event_booked_at: string | null
  invest_avond_geclaimd: boolean | null
  invest_avond_verschenen: boolean | null
}

type ExportInvite = {
  user_id: string
  used_at: string | null
}

function excelDate(value: string | null) {
  return value ? new Date(value) : ''
}

function statusFor(user: ExportUser, openInviteUserIds: Set<string>) {
  if (user.activated_at) return 'Geactiveerd'
  return openInviteUserIds.has(user.id) ? 'Aangemaakt' : 'Zonder link'
}

async function fetchAllUsers(supabase: ReturnType<typeof createAdminClient>) {
  const rows: ExportUser[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('demo_invest_users')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    rows.push(...((data ?? []) as ExportUser[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function fetchAllAccountLogs(supabase: ReturnType<typeof createAdminClient>) {
  const rows: { created_at: string; email: string | null; payload_json: Record<string, unknown> }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('demo_invest_account_webhook_log')
      .select('created_at, email, payload_json')
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()
  const [users, funnelsResult, invitesResult, followUpDisabledResult, accountLogs, bookingLinks] = await Promise.all([
    fetchAllUsers(supabase),
    supabase.from('demo_invest_user_funnel').select('*'),
    supabase.from('demo_invest_invites').select('user_id, used_at'),
    supabase.from('demo_invest_trigger_sent').select('user_id').eq('workflow_naam', '__automatische_opvolging_uit__'),
    fetchAllAccountLogs(supabase),
    getBookingLinks(supabase),
  ])

  const queryError = funnelsResult.error ?? invitesResult.error ?? followUpDisabledResult.error
  if (queryError) {
    return NextResponse.json({ error: 'De accountgegevens konden niet worden opgehaald.' }, { status: 500 })
  }

  const callStates = await getAllCallUserStates(supabase)
  const funnels = (funnelsResult.data ?? []) as ExportFunnel[]
  const invites = (invitesResult.data ?? []) as ExportInvite[]
  const funnelsByUser = new Map(funnels.map(funnel => [funnel.user_id, funnel]))
  const openInviteUserIds = new Set(invites.filter(invite => !invite.used_at).map(invite => invite.user_id))
  const followUpDisabledUserIds = new Set((followUpDisabledResult.data ?? []).map(row => row.user_id))
  const sourceByEmail = buildAccountSourceByEmail(accountLogs)
  const ownerNameById = new Map(
    bookingLinks
      .filter(link => link.actief && !link.is_default)
      .map(link => [link.owner_email.trim(), link.naam]),
  )

  const rows = users.map(user => {
    const funnel = funnelsByUser.get(user.id)
    const callState = callStates.get(user.id)
    return {
      Naam: user.name || '',
      'E-mailadres': user.email,
      Status: statusFor(user, openInviteUserIds),
      Rol: user.role === 'admin' ? 'Admin' : user.role === 'mentor' ? 'Mentor' : 'Gebruiker',
      Toegang: hasPermanentAccess(user.role) ? 'Onbeperkt' : 'Trial',
      Aangemaakt: excelDate(user.created_at),
      Geactiveerd: excelDate(user.activated_at),
      'Trial gestart': excelDate(user.trial_started_at),
      'Trial verloopt': hasPermanentAccess(user.role) ? 'Onbeperkt' : excelDate(user.trial_expires_at),
      'Laatste activiteit': excelDate(user.last_activity_at),
      Instroom: sourceByEmail.get(user.email.trim().toLowerCase()) === 'vermogenstest'
        ? 'Vermogenstest'
        : sourceByEmail.get(user.email.trim().toLowerCase()) === 'discovery'
          ? 'Discovery'
          : 'Onbekend',
      Accountmanager: callState?.contact_owner_email
        ? ownerNameById.get(callState.contact_owner_email.trim()) ?? 'Onbekend'
        : 'Round robin',
      'HubSpot owner-ID': callState?.contact_owner_email ?? '',
      'Adviescall gezien op': excelDate(callState?.call_opened_at ?? null),
      'Adviescall geklikt op': excelDate(callState?.call_clicked_at ?? null),
      'Adviescall geboekt': callState?.call_booked ? 'Ja' : 'Nee',
      'Adviescall geboekt op': excelDate(callState?.call_booked_at ?? null),
      'Video\'s voltooid': funnel?.videos_completed_count ?? 0,
      'Alle video\'s voltooid': excelDate(funnel?.all_completed_at ?? null),
      'Event geboekt': funnel?.event_booked ? 'Ja' : 'Nee',
      'Event geboekt op': excelDate(funnel?.event_booked_at ?? null),
      'Invest-avond geclaimd': funnel?.invest_avond_geclaimd ? 'Ja' : 'Nee',
      'Invest-avond verschenen': funnel?.invest_avond_verschenen ? 'Ja' : 'Nee',
      Taal: user.locale?.toUpperCase() || '',
      'WhatsApp opt-in': user.whatsapp_opt_in ? 'Ja' : 'Nee',
      'Automatische opvolging': followUpDisabledUserIds.has(user.id) ? 'Uit' : 'Aan',
    }
  })

  const workbook = utils.book_new()
  const sheets = [
    { name: 'Alle accounts', data: rows },
    { name: 'Aangemaakt', data: rows.filter(row => row.Status === 'Aangemaakt') },
    { name: 'Geactiveerd', data: rows.filter(row => row.Status === 'Geactiveerd') },
  ]

  for (const { name, data } of sheets) {
    const worksheet = utils.json_to_sheet(data, { cellDates: true })
    worksheet['!cols'] = [
      { wch: 24 }, { wch: 34 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 32 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 22 },
      { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
      { wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 24 },
    ]
    if (worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] }
    utils.book_append_sheet(workbook, worksheet, name)
  }

  const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx', cellDates: true })
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="archer-accounts-${date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
