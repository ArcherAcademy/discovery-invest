import { NextRequest, NextResponse } from 'next/server'
import { utils, write } from 'xlsx'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type DemoUser = {
  email: string
  role: 'user' | 'admin' | 'mentor'
  locale: string | null
  whatsapp_opt_in: boolean | null
  created_at: string
  activated_at: string | null
  trial_started_at: string | null
  trial_expires_at: string | null
  last_activity_at: string | null
}

type AccountWebhookLog = {
  id: number
  created_at: string
  email: string | null
  payload_json: Record<string, unknown> | null
  outcome: string
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function excelDate(value: string | null | undefined) {
  return value ? new Date(value) : ''
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()
  const [usersResult, logsResult] = await Promise.all([
    supabase
      .from('demo_invest_users')
      .select('email, role, locale, whatsapp_opt_in, created_at, activated_at, trial_started_at, trial_expires_at, last_activity_at')
      .eq('role', 'user')
      .order('created_at', { ascending: false }),
    supabase
      .from('demo_invest_account_webhook_log')
      .select('id, created_at, email, payload_json, outcome')
      .order('created_at', { ascending: false }),
  ])

  const queryError = usersResult.error ?? logsResult.error
  if (queryError) {
    return NextResponse.json({ error: 'De demo-inschrijvingen konden niet worden opgehaald.' }, { status: 500 })
  }

  const usersByEmail = new Map<string, DemoUser>()
  for (const user of (usersResult.data ?? []) as DemoUser[]) {
    const email = user.email.trim().toLowerCase()
    const current = usersByEmail.get(email)
    if (!current || Boolean(user.activated_at) > Boolean(current.activated_at)) {
      usersByEmail.set(email, user)
    }
  }

  const completeSubmissions = new Map<string, {
    firstName: string
    lastName: string
    email: string
    submittedAt: string
    pageUri: string
  }>()

  for (const log of (logsResult.data ?? []) as AccountWebhookLog[]) {
    const payload = log.payload_json ?? {}
    const pageUri = text(payload.page_uri)
    if (!pageUri.toLowerCase().includes('/demo') || log.outcome === 'error') continue

    const email = (text(payload.email) || text(log.email)).toLowerCase()
    const firstName = text(payload.firstname) || text(payload.first_name) || text(payload.voornaam)
    const lastName = text(payload.lastname) || text(payload.last_name) || text(payload.achternaam)

    if (!email || !firstName || !lastName || completeSubmissions.has(email)) continue
    completeSubmissions.set(email, { firstName, lastName, email, submittedAt: log.created_at, pageUri })
  }

  const rows = [...completeSubmissions.values()].map((submission, index) => {
    const user = usersByEmail.get(submission.email)
    return {
      'Nr.': index + 1,
      Voornaam: submission.firstName,
      Achternaam: submission.lastName,
      'Volledige naam': `${submission.firstName} ${submission.lastName}`,
      'E-mailadres': submission.email,
      'Formulier ingevuld op': excelDate(submission.submittedAt),
      Accountstatus: user?.activated_at ? 'Geactiveerd' : 'Niet geactiveerd',
      'Account aangemaakt op': excelDate(user?.created_at),
      'Account geactiveerd op': excelDate(user?.activated_at),
      'Trial gestart op': excelDate(user?.trial_started_at),
      'Trial vervalt op': excelDate(user?.trial_expires_at),
      'Laatste activiteit': excelDate(user?.last_activity_at),
      'WhatsApp opt-in': user?.whatsapp_opt_in ? 'Ja' : 'Nee',
      Taal: user?.locale?.toUpperCase() ?? '',
      Pagina: submission.pageUri,
    }
  })

  const activated = rows.filter(row => row.Accountstatus === 'Geactiveerd').length
  const workbook = utils.book_new()
  const peopleSheet = utils.json_to_sheet(rows, { cellDates: true })
  peopleSheet['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 22 }, { wch: 32 }, { wch: 36 },
    { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 23 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 62 },
  ]
  if (peopleSheet['!ref']) peopleSheet['!autofilter'] = { ref: peopleSheet['!ref'] }

  const summarySheet = utils.json_to_sheet([
    { Kengetal: 'Aantal volledige unieke personen', Waarde: rows.length },
    { Kengetal: 'Geactiveerde accounts', Waarde: activated },
    { Kengetal: 'Niet-geactiveerde accounts', Waarde: rows.length - activated },
    { Kengetal: 'Activatiegraad', Waarde: rows.length ? activated / rows.length : 0 },
    { Kengetal: 'Selectie', Waarde: 'Unieke personen met voornaam, achternaam en e-mail via een /demo-pagina; foutieve inzendingen uitgesloten.' },
  ])
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 86 }]
  if (summarySheet.B4) summarySheet.B4.z = '0.0%'

  utils.book_append_sheet(workbook, peopleSheet, 'Personen')
  utils.book_append_sheet(workbook, summarySheet, 'Samenvatting')

  const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx', cellDates: true, compression: true })
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="demo-pagina-volledige-personen-${date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
