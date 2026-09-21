'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/components/app-context'
import { useRouter } from 'next/navigation'
import { t } from '@/lib/i18n'
import { Users, TrendingUp, Trophy, CalendarDays, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, RefreshCw, Copy, Check, Trash2, X, Send, MailWarning, Search, ShieldCheck, UserPlus, UserMinus, Download } from 'lucide-react'
import { WORKFLOWS } from '@/lib/workflow-engine'
import { HUBSPOT_CODES_ORDERED } from '@/lib/hubspot-codes'
import { VoortgangTab } from '@/components/admin/VoortgangTab'
import { InhaalrondeModal } from '@/components/admin/InhaalrondeModal'
import { UserFollowUpControl } from '@/components/admin/UserFollowUpControl'
import { BookingLinksTab } from '@/components/admin/BookingLinksTab'
import { CallBookingsOverview } from '@/components/admin/CallBookingsOverview'
import type { DemoUser, DemoUserFunnel, DemoWebhookLog, DemoTriggerLog, DemoWebhookConfig, AccountWebhookLog, DemoQuizSubmission } from '@/lib/types'
import { QUIZ_QUESTIONS } from '@/lib/quiz-data'
import { hasPermanentAccess, isTrialExpired, trialDaysRemaining } from '@/lib/access'

interface AdminUser extends DemoUser {
  funnel?: DemoUserFunnel
  /** Numerieke HubSpot owner-ID — wordt via bookingOwners naar een naam vertaald. */
  hubspot_owner_id?: string | null
  /** Herkomst van het account, server-side bepaald uit de eerste bekende instroom. */
  instroom?: 'vermogenstest' | 'discovery' | 'onbekend'
  // Live afgeleide call-status en opvolgvlag — server-side samengevoegd in /api/admin/data.
  call_clicked_at?: string | null
  call_opened_at?: string | null
  opvolging_actief?: boolean
}

type AccountStatus = 'aangemaakt' | 'geactiveerd'

type Tab = 'overview' | 'accounts' | 'users' | 'mentors' | 'webhooks' | 'workflows' | 'history' | 'account_logs' | 'voortgang'

const ACCOUNTS_PER_PAGE = 50

function getVisibleAccountPages(currentPage: number, pageCount: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const pages: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1]
  if (currentPage > 4) pages.push('ellipsis-start')

  const rangeStart = Math.max(2, currentPage - 1)
  const rangeEnd = Math.min(pageCount - 1, currentPage + 1)
  for (let page = rangeStart; page <= rangeEnd; page += 1) pages.push(page)

  if (currentPage < pageCount - 3) pages.push('ellipsis-end')
  pages.push(pageCount)
  return pages
}

export default function AdminPage() {
  const { user, locale } = useApp()
  const router = useRouter()
  const tr = t(locale)

  const [tab, setTab] = useState<Tab>('overview')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [accountTotal, setAccountTotal] = useState(0)
  const [accountPage, setAccountPage] = useState(1)
  const [webhookLog, setWebhookLog] = useState<DemoWebhookLog[]>([])
  const [triggerLog, setTriggerLog] = useState<DemoTriggerLog[]>([])
  const [webhookConfig, setWebhookConfig] = useState<DemoWebhookConfig[]>([])
  const [accountsFilter, setAccountsFilter] = useState<{ query: string; status: '' | AccountStatus }>({ query: '', status: '' })
  const [instroomFilter, setInstroomFilter] = useState<'' | 'vermogenstest' | 'discovery' | 'onbekend'>('')
  const [accountManagerFilter, setAccountManagerFilter] = useState<string>('')
  const [accountLogs, setAccountLogs] = useState<AccountWebhookLog[]>([])
  const [accountLogsFilter, setAccountLogsFilter] = useState<{ email: string; outcome: '' | 'created' | 'reused' | 'error' }>({ email: '', outcome: '' })
  const [quizSubmissions, setQuizSubmissions] = useState<DemoQuizSubmission[]>([])
  const [bookingOwners, setBookingOwners] = useState<Record<string, string>>({})
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'email' | 'videos' | 'days'>('videos')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterEmail, setFilterEmail] = useState('')
  const [onlyWithVideos, setOnlyWithVideos] = useState(false)
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [historyFilter, setHistoryFilter] = useState<{ email: string; workflow: string; periode: 'vandaag' | 'week' | 'alles' }>({ email: '', workflow: '', periode: 'alles' })
  const [evaluatorRunning, setEvaluatorRunning] = useState(false)
  const [evaluatorResult, setEvaluatorResult] = useState<{ usersProcessed: number; triggered: number; suppressed: number } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; email: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Mentorbeheer (alleen admins)
  const [mentorQuery, setMentorQuery] = useState('')
  const [roleLoading, setRoleLoading] = useState<string | null>(null)
  const [roleFeedback, setRoleFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [demoExportLoading, setDemoExportLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleAccountsExport() {
    setExportLoading(true)
    setExportError(null)
    try {
      const response = await fetch('/api/admin/export-accounts')
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setExportError(data?.error ?? 'De Excel-export kon niet worden gemaakt.')
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'archer-accounts.xlsx'
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch {
      setExportError('Netwerkfout. Probeer de export opnieuw.')
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDemoExport() {
    setDemoExportLoading(true)
    setExportError(null)
    try {
      const response = await fetch('/api/admin/export-demo')
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setExportError(data?.error ?? 'De demo-export kon niet worden gemaakt.')
        return
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'demo-pagina-volledige-personen.xlsx'
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch {
      setExportError('Netwerkfout. Probeer de demo-export opnieuw.')
    } finally {
      setDemoExportLoading(false)
    }
  }

  async function handleRoleChange(target: AdminUser, role: 'user' | 'mentor') {
    setRoleLoading(target.id)
    setRoleFeedback(null)
    try {
      const res = await fetch('/api/admin/make-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: target.id, role }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setRoleFeedback({ ok: false, message: data?.error ?? 'De rol kon niet worden gewijzigd.' })
        return
      }
      setUsers(current => current.map(item => item.id === target.id ? { ...item, ...data.user } : item))
      setRoleFeedback({
        ok: true,
        message: role === 'mentor'
          ? `${target.name || target.email} is nu mentor.`
          : `${target.name || target.email} is teruggezet naar gebruiker.`,
      })
    } catch {
      setRoleFeedback({ ok: false, message: 'Netwerkfout. Probeer opnieuw.' })
    } finally {
      setRoleLoading(null)
    }
  }

  // Extend trial
  const [extendLoading, setExtendLoading] = useState<string | null>(null) // userId
  const [extendResult, setExtendResult] = useState<{ userId: string; newExpiry: string; reactivated: boolean } | null>(null)
  const [extendError, setExtendError] = useState<{ userId: string; msg: string } | null>(null)

  async function handleExtendTrial(userId: string, days: number) {
    setExtendLoading(userId)
    setExtendResult(null)
    setExtendError(null)
    try {
      const res = await fetch('/api/admin/extend-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, days }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        // Niet stil falen: zonder deze melding lijkt een geweigerde verlenging gelukt.
        setExtendError({
          userId,
          msg: res.status === 403 ? 'Geen rechten' : (data?.error ?? 'Mislukt'),
        })
        return
      }
      setExtendResult({ userId, newExpiry: data.new_expires_at, reactivated: !!data.reactivated })
      // Refresh user list — laat de statusbadge en 'Trial resterend' meteen omslaan.
      const r = await fetch('/api/admin/data')
      if (r.ok) {
        const d = await r.json()
        if (d.users && d.funnels) {
          const funnelMap = new Map((d.funnels as DemoUserFunnel[]).map((f: DemoUserFunnel) => [f.user_id, f]))
          const refreshedUsers = (d.users as DemoUser[]).map((u: DemoUser) => ({ ...u, funnel: funnelMap.get(u.id) }))
          setUsers(refreshedUsers)
          setAccountTotal(typeof d.accountTotal === 'number' ? d.accountTotal : refreshedUsers.length)
        }
        if (d.bookingOwners) setBookingOwners(d.bookingOwners as Record<string, string>)
      }
    } catch {
      setExtendError({ userId, msg: 'Netwerkfout' })
    } finally {
      setExtendLoading(null)
    }
  }

  // Manual workflow trigger (per-user, via workflow row button)
  const [triggerModal, setTriggerModal] = useState<{ triggerNaam: string; label: string } | null>(null)
  const [triggerUserId, setTriggerUserId] = useState('')
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Free-form test trigger (any code, any email/naam)
  const [testModal, setTestModal] = useState(false)
  const [inhaalModal, setInhaalModal] = useState(false)
  const [testCode, setTestCode] = useState(HUBSPOT_CODES_ORDERED[0].code)
  const [testEmail, setTestEmail] = useState('')
  const [testNaam, setTestNaam] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const isMentor = user?.role === 'mentor'
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'mentor') router.push('/home')
  }, [user, router])

  useEffect(() => {
    // Only load data once we have a confirmed admin/mentor user — avoids firing
    // before the app context resolves and ensures RLS policies pass.
    if (!user || (user.role !== 'admin' && user.role !== 'mentor')) return

    async function load() {
      const res = await fetch('/api/admin/data')
      if (!res.ok) return
      const d = await res.json()
      if (d.users && d.funnels) {
        const funnelMap = new Map((d.funnels as DemoUserFunnel[]).map((f: DemoUserFunnel) => [f.user_id, f]))
        const combined = (d.users as DemoUser[]).map((u: DemoUser) => ({ ...u, funnel: funnelMap.get(u.id) }))
        setUsers(combined)
        setAccountTotal(typeof d.accountTotal === 'number' ? d.accountTotal : combined.length)
      }
      if (d.logs) setWebhookLog(d.logs as DemoWebhookLog[])
      if (d.triggerLogs) setTriggerLog(d.triggerLogs as DemoTriggerLog[])
      if (d.webhookConfig) setWebhookConfig(d.webhookConfig as DemoWebhookConfig[])
      if (d.accountLogs) setAccountLogs(d.accountLogs as AccountWebhookLog[])
      if (d.quizSubmissions) setQuizSubmissions(d.quizSubmissions as DemoQuizSubmission[])
      if (d.bookingOwners) setBookingOwners(d.bookingOwners as Record<string, string>)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Still loading context �� don't redirect or render yet
  if (!user) return null
  // Confirmed non-admin/non-mentor — redirect handled by the effect above
  if (user.role !== 'admin' && user.role !== 'mentor') return null

  const now = new Date()
  // Admin en mentor hebben onbeperkte toegang en tellen niet mee als trial.
  const activeTrials = users.filter(u => !hasPermanentAccess(u.role) && u.activated_at && u.trial_expires_at && new Date(u.trial_expires_at) > now).length
  const activated = users.filter(u => u.activated_at).length
  const activationRate = users.length > 0 ? Math.round((activated / users.length) * 100) : 0
  const avgProgress = users.length > 0 ? Math.round(users.reduce((s, u) => s + (u.funnel?.videos_completed_count ?? 0), 0) / users.length * 10) / 10 : 0
  const allCompleted = users.filter(u => (u.funnel?.videos_completed_count ?? 0) >= 6).length
  const eventsBooked = users.filter(u => u.funnel?.event_booked).length
  const expired = users.filter(u => isTrialExpired(u, now)).length

  const kpis = [
    { label: tr.admin.activeTrials, value: activeTrials, icon: <Users size={16} /> },
    { label: tr.admin.activationRate, value: `${activationRate}%`, icon: <TrendingUp size={16} /> },
    { label: tr.admin.avgProgress, value: `${avgProgress}/6`, icon: <TrendingUp size={16} /> },
    { label: tr.admin.allCompleted, value: allCompleted, icon: <Trophy size={16} /> },
    { label: tr.admin.eventsBooked, value: eventsBooked, icon: <CalendarDays size={16} /> },
    { label: tr.admin.expired, value: expired, icon: <Clock size={16} /> },
  ]

  // Geeft null voor admin/mentor (onbeperkte toegang) en voor accounts zonder
  // trialdatum. Rolgebaseerd en live — zie lib/access.ts.
  function trialDaysLeft(u: DemoUser) {
    return trialDaysRemaining(u, now)
  }

  function formatDate(d: string | null) {
    if (!d) return tr.admin.never
    return new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  function formatDateTime(d: string) {
    return new Date(d).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  // 'createdTo' is inclusief: we tellen tot het einde van de gekozen dag,
  // anders zou een account dat op de einddatum is aangemaakt wegvallen.
  const createdToEnd = createdTo ? new Date(`${createdTo}T23:59:59.999`).getTime() : null
  const createdFromStart = createdFrom ? new Date(`${createdFrom}T00:00:00`).getTime() : null

  const sortedUsers = [...users]
    .filter(u => u.email?.toLowerCase().includes(filterEmail.toLowerCase()))
    .sort((a, b) => {
      let diff = 0
      if (sortField === 'email') diff = (a.email ?? '').localeCompare(b.email ?? '')
      if (sortField === 'videos') diff = (a.funnel?.videos_completed_count ?? 0) - (b.funnel?.videos_completed_count ?? 0)
      if (sortField === 'days') diff = (trialDaysLeft(a) ?? 0) - (trialDaysLeft(b) ?? 0)
      return sortDir === 'asc' ? diff : -diff
    })

  // Accountstatus meet uitsluitend de marketingfunnel: ieder account is eerst
  // aangemaakt en wordt geactiveerd zodra activated_at is gezet. De technische
  // toestand van een invite mag die status nooit veranderen.
  function getAccountStatus(u: DemoUser): AccountStatus {
    return u.activated_at ? 'geactiveerd' : 'aangemaakt'
  }

  function hoeLangGeleden(isoDate: string): string {
    const diffMs = now.getTime() - new Date(isoDate).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 60) return `${mins}m geleden`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}u geleden`
    return `${Math.floor(hours / 24)}d geleden`
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const userLogs = (userId: string) => webhookLog.filter(l => l.user_id === userId)

  // Herkomst / signup-source tags per account. Data komt uit al ingeladen state:
  //   - "vermogenstest": gebruiker heeft de quiz ingevuld (demo_invest_quiz_submissions)
  //   - "website" / "HubSpot": _bron uit de account-aanmaken webhook-log, gematcht op e-mail
  const userTags = (u: DemoUser): string[] => {
    const tags: string[] = []
    if (quizSubmissions.some(q => q.user_id === u.id)) tags.push('vermogenstest')
    const email = (u.email ?? '').toLowerCase()
    if (email) {
      const log = accountLogs.find(l => (l.email ?? '').toLowerCase() === email)
      const bron = log?.payload_json?._bron
      if (bron === 'website') tags.push('website')
      else if (bron === 'hubspot') tags.push('HubSpot')
    }
    return tags
  }

  async function handleRunEvaluator() {
    setEvaluatorRunning(true)
    setEvaluatorResult(null)
    try {
      const res = await fetch('/api/admin/run-evaluator', { method: 'POST' })
      const data = await res.json()
      if (data.ok) setEvaluatorResult(data)
    } finally {
      setEvaluatorRunning(false)
    }
  }

  async function handleDeleteUser() {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleteConfirm.userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error ?? 'Verwijderen mislukt.')
        return
      }
      // Remove from local state immediately
      setUsers(prev => prev.filter(u => u.id !== deleteConfirm.userId))
      setAccountTotal(total => Math.max(0, total - 1))
      setDeleteConfirm(null)
    } catch {
      setDeleteError('Netwerk fout. Probeer opnieuw.')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleManualTrigger() {
    if (!triggerModal || !triggerUserId) return
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const res = await fetch('/api/admin/trigger-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: triggerUserId, triggerNaam: triggerModal.triggerNaam }),
      })
      const data = await res.json()
      if (data.ok) {
        setTriggerResult({ ok: true, msg: `Verstuurd naar ${data.email}` })
      } else {
        setTriggerResult({ ok: false, msg: data.error ?? 'Onbekende fout' })
      }
    } catch {
      setTriggerResult({ ok: false, msg: 'Netwerk fout' })
    } finally {
      setTriggerLoading(false)
    }
  }

  async function handleTestTrigger() {
    if (!testEmail.trim()) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/test-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hubspotCode: testCode, email: testEmail.trim(), naam: testNaam.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestResult({ ok: true, msg: `Verstuurd: code "${data.hubspot_code}" naar ${data.email} (HTTP ${data.responseStatus})` })
      } else {
        setTestResult({ ok: false, msg: data.error ?? 'Onbekende fout' })
      }
    } catch {
      setTestResult({ ok: false, msg: 'Netwerk fout' })
    } finally {
      setTestLoading(false)
    }
  }

  async function handleToggleWorkflow(triggerNaam: string, current: boolean) {
    await fetch('/api/admin/webhook-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_naam: triggerNaam, actief: !current }),
    })
    setWebhookConfig(prev => prev.map(c => c.trigger_naam === triggerNaam ? { ...c, actief: !current } : c))
  }

  async function handleCallBookedUpdate(userId: string, callBooked: boolean) {
    const response = await fetch('/api/admin/user-owner', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, call_booked: callBooked }),
    })
    if (!response.ok) return
    setUsers(current => current.map(item => item.id === userId
      ? { ...item, call_booked: callBooked, call_booked_at: callBooked ? new Date().toISOString() : null }
      : item))
  }

  // Tabs accessible to mentor (opvolg-tabs only)
  const MENTOR_TABS: Tab[] = ['overview', 'accounts', 'voortgang', 'users']

  const ALL_TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: tr.admin.overview },
    { id: 'accounts', label: 'Accounts' },
    { id: 'voortgang', label: 'Voortgang' },
    { id: 'users', label: tr.admin.users },
    { id: 'mentors', label: 'Mentoren' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'history', label: 'Trigger-history' },
    { id: 'webhooks', label: tr.admin.webhookLog },
    { id: 'account_logs', label: 'Aanmaken logs' },
  ]

  const TABS = isMentor ? ALL_TABS.filter(t => MENTOR_TABS.includes(t.id)) : ALL_TABS

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" style={{ color: '#0d0f14' }}>{tr.admin.title}</h1>
        <div className="flex items-center gap-3">
          {evaluatorResult && (
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}>
              {evaluatorResult.usersProcessed} gebruikers · {evaluatorResult.triggered} gefired · {evaluatorResult.suppressed} onderdrukt
            </span>
          )}
          {isAdmin && (
            <button
              onClick={handleRunEvaluator}
              disabled={evaluatorRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: '#2500F5', color: '#fff' }}
            >
              <RefreshCw size={13} className={evaluatorRunning ? 'animate-spin' : ''} />
              {evaluatorRunning ? 'Bezig...' : 'Evaluator draaien'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs — horizontally scrollable strip on mobile, equal-width on larger screens */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto sm:overflow-x-visible" style={{ background: '#f0f3fb', border: '1px solid #e8ecf4' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="sm:flex-1 shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={
              tab === t.id
                ? { background: '#2500F5', color: '#fff' }
                : { color: 'rgba(13,15,20,0.55)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border p-5"
                style={{ background: '#ffffff', borderColor: '#e8ecf4' }}
              >
                <div className="mb-2 flex items-center gap-2" style={{ color: '#2500F5' }}>
                  {kpi.icon}
                </div>
                <p className="text-2xl font-bold" style={{ color: '#0d0f14' }}>{kpi.value}</p>
                <p className="mt-0.5 text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>{kpi.label}</p>
              </div>
            ))}
          </div>

          <CallBookingsOverview />

          {isAdmin && (
            <section className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#2500F5' }}>Instellingen</p>
                <h2 className="mt-1 text-xl font-bold text-balance" style={{ color: '#0d0f14' }}>Beheer boekingslinks</h2>
                <p className="mt-1 text-sm leading-6" style={{ color: 'rgba(13,15,20,0.55)' }}>
                  Beheer hier welke persoonlijke HubSpot-agenda bij elke contacteigenaar hoort.
                </p>
              </div>
              <BookingLinksTab />
            </section>
          )}
        </div>
      )}

      {/* Mentorenbeheer — uitsluitend zichtbaar voor admins */}
      {tab === 'mentors' && isAdmin && (() => {
        const team = users
          .filter(member => member.role === 'admin' || member.role === 'mentor')
          .sort((a, b) => {
            if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
            return (a.name || a.email || '').localeCompare(b.name || b.email || '')
          })
        const query = mentorQuery.trim().toLowerCase()
        const candidates = query.length >= 2
          ? users
              .filter(candidate => candidate.role === 'user')
              .filter(candidate => `${candidate.name ?? ''} ${candidate.email ?? ''}`.toLowerCase().includes(query))
              .slice(0, 8)
          : []

        return (
          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border p-5 md:p-6" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2" style={{ color: '#2500F5' }}>
                  <ShieldCheck size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Teamtoegang</span>
                </div>
                <h2 className="text-xl font-bold text-balance" style={{ color: '#0d0f14' }}>Admins en mentoren</h2>
                <p className="max-w-2xl text-sm leading-6" style={{ color: 'rgba(13,15,20,0.55)' }}>
                  Elke mentor heeft onbeperkte toegang en kan voor alle gebruikers een trial met 3 of 7 dagen verlengen.
                </p>
              </div>

              <div className="mt-5 overflow-x-auto rounded-xl border" style={{ borderColor: '#e8ecf4' }}>
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead style={{ background: '#f7f8fc', color: 'rgba(13,15,20,0.5)' }}>
                    <tr>
                      <th className="px-4 py-3 font-semibold">Naam</th>
                      <th className="px-4 py-3 font-semibold">E-mail</th>
                      <th className="px-4 py-3 font-semibold">Rol</th>
                      <th className="px-4 py-3 font-semibold">Toegang</th>
                      <th className="px-4 py-3 text-right font-semibold">Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map(member => (
                      <tr key={member.id} className="border-t" style={{ borderColor: '#e8ecf4' }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#0d0f14' }}>{member.name || '���'}</td>
                        <td className="px-4 py-3" style={{ color: 'rgba(13,15,20,0.65)' }}>{member.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: member.role === 'admin' ? '#0d0f14' : 'rgba(37,0,245,0.08)', color: member.role === 'admin' ? '#ffffff' : '#2500F5' }}>
                            {member.role === 'admin' ? 'Admin' : 'Mentor'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#16a34a' }}>Onbeperkt</td>
                        <td className="px-4 py-3 text-right">
                          {member.role === 'mentor' ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Zet ${member.name || member.email} terug naar gebruiker?`)) {
                                  handleRoleChange(member, 'user')
                                }
                              }}
                              disabled={roleLoading === member.id}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                              style={{ background: '#f0f3fb', color: '#0d0f14' }}
                            >
                              <UserMinus size={14} />
                              {roleLoading === member.id ? 'Bezig…' : 'Terugzetten'}
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: 'rgba(13,15,20,0.35)' }}>Beheerd als admin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border p-5 md:p-6" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold" style={{ color: '#0d0f14' }}>Mentor toevoegen</h2>
                <p className="text-sm leading-6" style={{ color: 'rgba(13,15,20,0.55)' }}>
                  Zoek een bestaand gebruikersaccount op naam of e-mail. De nieuwe rechten gelden meteen, ook in een bestaande sessie.
                </p>
                <label className="relative mt-2 block max-w-xl">
                  <span className="sr-only">Zoek een gebruiker</span>
                  <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(13,15,20,0.4)' }} />
                  <input
                    type="search"
                    value={mentorQuery}
                    onChange={event => setMentorQuery(event.target.value)}
                    placeholder="Zoek op naam of e-mail…"
                    className="w-full rounded-xl border py-3 pl-10 pr-4 text-sm outline-none transition-shadow focus:ring-2"
                    style={{ background: '#f7f8fc', borderColor: '#e8ecf4', color: '#0d0f14' }}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {query.length > 0 && query.length < 2 && (
                  <p className="text-sm" style={{ color: 'rgba(13,15,20,0.45)' }}>Typ minstens twee tekens.</p>
                )}
                {query.length >= 2 && candidates.length === 0 && (
                  <p className="rounded-xl p-4 text-sm" style={{ background: '#f7f8fc', color: 'rgba(13,15,20,0.55)' }}>
                    Geen gewone gebruiker gevonden. Bestaande admins en mentoren staan hierboven.
                  </p>
                )}
                {candidates.map(candidate => (
                  <div key={candidate.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#e8ecf4' }}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ color: '#0d0f14' }}>{candidate.name || 'Naam onbekend'}</p>
                      <p className="truncate text-sm" style={{ color: 'rgba(13,15,20,0.5)' }}>{candidate.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRoleChange(candidate, 'mentor')}
                      disabled={roleLoading === candidate.id}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-40"
                      style={{ background: '#2500F5', color: '#ffffff' }}
                    >
                      <UserPlus size={16} />
                      {roleLoading === candidate.id ? 'Bezig…' : 'Maak mentor'}
                    </button>
                  </div>
                ))}
              </div>

              {roleFeedback && (
                <p role="status" className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: roleFeedback.ok ? 'rgba(34,197,94,0.1)' : '#f0f3fb', color: roleFeedback.ok ? '#16a34a' : '#0d0f14' }}>
                  {roleFeedback.message}
                </p>
              )}
            </section>
          </div>
        )
      })()}

      {/* Voortgang tab */}
      {tab === 'voortgang' && <VoortgangTab />}

      {/* Accounts tab */}
      {tab === 'accounts' && (() => {
        // Status-badge config (geen rood/warm, geen goud)
        const statusConfig: Record<AccountStatus, { label: string; bg: string; color: string }> = {
          aangemaakt:  { label: 'Aangemaakt',  bg: 'rgba(37,0,245,0.08)', color: '#2500F5' },
          geactiveerd: { label: 'Geactiveerd', bg: 'rgba(34,197,94,0.1)', color: '#16a34a' },
        }

        // Set dat álle filters behalve de statuskeuze respecteert. De telkaarten
        // splitsen zelf op status, dus die mag hun cijfers niet inperken — maar
        // het tijdvak (en zoek/video-filter) moet wél doorwerken zodat de KPI's
        // meebewegen met de gekozen periode.
        const scopedUsers = users.filter(u => {
          const q = accountsFilter.query.trim().toLowerCase()
          const queryOk = !q || (u.email ?? '').toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)
          const videosOk = !onlyWithVideos || (u.funnel?.videos_completed_count ?? 0) >= 1
          let dateOk = true
          if (createdFromStart !== null || createdToEnd !== null) {
            const created = new Date(u.created_at).getTime()
            if (createdFromStart !== null && created < createdFromStart) dateOk = false
            if (createdToEnd !== null && created > createdToEnd) dateOk = false
          }
          return queryOk && videosOk && dateOk
        })

        // Telkaarten (KPI's) over het gescopete set — bewegen mee met het tijdvak.
        const aangemaakt = scopedUsers.filter(u => getAccountStatus(u) === 'aangemaakt').length
        const geactiveerd = scopedUsers.filter(u => getAccountStatus(u) === 'geactiveerd').length
        const activatiegraad = scopedUsers.length > 0 ? Math.round((geactiveerd / scopedUsers.length) * 100) : 0

    // Instroom wordt server-side uit het eerste expliciete bronsignaal bepaald.
    // Ontbrekende broninformatie blijft zichtbaar als 'Onbekend' en wordt nooit
    // stilzwijgend bij Discovery geteld.
    const isVermogenstest = (u: AdminUser) => u.instroom === 'vermogenstest'
    const vermogenstestCount = scopedUsers.filter(isVermogenstest).length
    const discoveryCount = scopedUsers.filter(u => u.instroom === 'discovery').length
    const onbekendCount = scopedUsers.filter(u => u.instroom === 'onbekend').length

    // HubSpot owner-id → accountmanagernaam. Onbekende ids vallen terug op het id
    // zelf, zodat een ontbrekende boekingslink nooit een leeg veld oplevert.
    const ownerName = (id?: string | null) => {
      const key = (id ?? '').trim()
      if (!key) return ''
      return bookingOwners[key] ?? key
    }

    // Lijst met accountmanagers (lead owners) voor het dropdownfilter. Accounts
    // zonder eigenaar vallen onder 'Round robin'.
    const accountManagers = Array.from(
      new Set(users.map(u => (u.hubspot_owner_id ?? '').trim()).filter(Boolean))
    ).sort((a, b) => ownerName(a).localeCompare(ownerName(b)))

        const filtered = scopedUsers
          .filter(u => !accountsFilter.status || getAccountStatus(u) === accountsFilter.status)
          .filter(u => !instroomFilter || u.instroom === instroomFilter)
          .filter(u => {
            if (!accountManagerFilter) return true
            const owner = (u.hubspot_owner_id ?? '').trim().toLowerCase()
            if (accountManagerFilter === '__roundrobin__') return !owner
            return owner === accountManagerFilter
          })
          .sort((a, b) => {
            const createdDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            return createdDifference || b.id.localeCompare(a.id)
          })
        const pageCount = Math.max(1, Math.ceil(filtered.length / ACCOUNTS_PER_PAGE))
        const activePage = Math.min(accountPage, pageCount)
        const pageStart = (activePage - 1) * ACCOUNTS_PER_PAGE
        const visibleAccounts = filtered.slice(pageStart, pageStart + ACCOUNTS_PER_PAGE)
        const rangeStart = filtered.length === 0 ? 0 : pageStart + 1
        const rangeEnd = Math.min(pageStart + ACCOUNTS_PER_PAGE, filtered.length)
        const visiblePages = getVisibleAccountPages(activePage, pageCount)
        const isFiltered = Boolean(accountsFilter.status || accountsFilter.query.trim() || onlyWithVideos || createdFrom || createdTo || instroomFilter || accountManagerFilter)

        return (
          <div className="space-y-5">
            {/* Telkaarten */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Aangemaakt, niet geactiveerd', value: aangemaakt, bg: 'rgba(37,0,245,0.06)', color: '#2500F5', border: 'rgba(37,0,245,0.12)' },
                { label: 'Geactiveerd', value: geactiveerd, bg: 'rgba(34,197,94,0.07)', color: '#16a34a', border: 'rgba(34,197,94,0.18)' },
                { label: 'Activatiegraad', value: `${activatiegraad}%`, bg: '#ffffff', color: '#0d0f14', border: '#e8ecf4' },
                { label: 'Vermogenstest', value: vermogenstestCount, bg: 'rgba(37,0,245,0.06)', color: '#2500F5', border: 'rgba(37,0,245,0.12)' },
                { label: 'Discovery', value: discoveryCount, bg: '#ffffff', color: '#0d0f14', border: '#e8ecf4' },
                { label: 'Instroom onbekend', value: onbekendCount, bg: '#f7f8fc', color: 'rgba(13,15,20,0.45)', border: '#e8ecf4' },
              ].map(card => (
                <div
                  key={card.label}
                  className="p-4 rounded-2xl border"
                  style={{ background: card.bg, borderColor: card.border }}
                >
                  <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                  <p className="text-xs mt-1 leading-snug" style={{ color: 'rgba(13,15,20,0.45)' }}>{card.label}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#e8ecf4' }}>
                {([
                  { value: '' as const,           label: 'Alles' },
                  { value: 'aangemaakt' as const,  label: 'Aangemaakt' },
                  { value: 'geactiveerd' as const, label: 'Geactiveerd' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setAccountsFilter(f => ({ ...f, status: opt.value }))
                      setAccountPage(1)
                    }}
                    className="px-3 py-2 text-xs font-medium transition-all"
                    style={accountsFilter.status === opt.value
                      ? { background: '#2500F5', color: '#fff' }
                      : { background: '#fff', color: 'rgba(13,15,20,0.55)' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Zoek op naam of e-mail..."
                value={accountsFilter.query}
                onChange={e => {
                  setAccountsFilter(f => ({ ...f, query: e.target.value }))
                  setAccountPage(1)
                }}
                className="rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#fff', borderColor: '#e8ecf4', color: '#0d0f14', minWidth: 220 }}
              />
              <button
                type="button"
                onClick={() => {
                  setOnlyWithVideos(v => !v)
                  setAccountPage(1)
                }}
                className="rounded-xl px-3 py-2 text-xs font-medium border transition-colors"
                style={{
                  background: onlyWithVideos ? 'rgba(37,0,245,0.1)' : '#fff',
                  borderColor: onlyWithVideos ? '#2500F5' : '#e8ecf4',
                  color: onlyWithVideos ? '#2500F5' : 'rgba(13,15,20,0.55)',
                }}
                aria-pressed={onlyWithVideos}
              >
                Minstens 1 video bekeken
              </button>
              <select
                value={instroomFilter}
                onChange={e => {
                  setInstroomFilter(e.target.value as '' | 'vermogenstest' | 'discovery' | 'onbekend')
                  setAccountPage(1)
                }}
                className="rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#fff', borderColor: instroomFilter ? '#2500F5' : '#e8ecf4', color: instroomFilter ? '#2500F5' : 'rgba(13,15,20,0.55)' }}
                aria-label="Filter op instroom"
              >
                <option value="">Alle instroom ({scopedUsers.length})</option>
                <option value="vermogenstest">Vermogenstest ({vermogenstestCount})</option>
                <option value="discovery">Discovery ({discoveryCount})</option>
                <option value="onbekend">Onbekend ({onbekendCount})</option>
              </select>
              <select
                value={accountManagerFilter}
                onChange={e => {
                  setAccountManagerFilter(e.target.value)
                  setAccountPage(1)
                }}
                className="rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#fff', borderColor: accountManagerFilter ? '#2500F5' : '#e8ecf4', color: accountManagerFilter ? '#2500F5' : 'rgba(13,15,20,0.55)' }}
                aria-label="Filter op accountmanager"
              >
                <option value="">Alle accountmanagers</option>
                <option value="__roundrobin__">Round robin (geen eigenaar)</option>
                {accountManagers.map(owner => (
                  <option key={owner} value={owner}>{ownerName(owner)}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>Aangemaakt van</span>
                  <input
                    type="date"
                    value={createdFrom}
                    max={createdTo || undefined}
                    onChange={e => { setCreatedFrom(e.target.value); setAccountPage(1) }}
                    className="rounded-xl px-2.5 py-2 text-xs border outline-none"
                    style={{ background: '#fff', borderColor: '#e8ecf4', color: '#0d0f14' }}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>tot</span>
                  <input
                    type="date"
                    value={createdTo}
                    min={createdFrom || undefined}
                    onChange={e => { setCreatedTo(e.target.value); setAccountPage(1) }}
                    className="rounded-xl px-2.5 py-2 text-xs border outline-none"
                    style={{ background: '#fff', borderColor: '#e8ecf4', color: '#0d0f14' }}
                  />
                </label>
                {(createdFrom || createdTo) && (
                  <button
                    type="button"
                    onClick={() => { setCreatedFrom(''); setCreatedTo(''); setAccountPage(1) }}
                    className="rounded-xl px-2.5 py-2 text-xs border transition-colors hover:opacity-80"
                    style={{ background: '#fff', borderColor: '#e8ecf4', color: 'rgba(13,15,20,0.55)' }}
                    title="Datumfilter wissen"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>
                {isFiltered ? `${filtered.length} van ${accountTotal}` : accountTotal} accounts
              </span>
              <button
                type="button"
                onClick={handleDemoExport}
                disabled={demoExportLoading}
                className="ml-auto inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
                style={{ background: '#ffffff', borderColor: '#2500F5', color: '#2500F5' }}
              >
                {demoExportLoading ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                {demoExportLoading ? 'Demo Excel maken…' : 'Download demo-inschrijvingen'}
              </button>
              <button
                type="button"
                onClick={handleAccountsExport}
                disabled={exportLoading}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
                style={{ background: '#2500F5', color: '#ffffff' }}
              >
                {exportLoading ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                {exportLoading ? 'Excel maken…' : 'Download alle accounts'}
              </button>
            </div>
            {exportError && (
              <p role="alert" className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: '#f0f3fb', color: '#0d0f14' }}>
                {exportError}
              </p>
            )}

            {/* Tabel */}
            <div className="rounded-2xl border overflow-hidden relative" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
            <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10" style={{ background: 'linear-gradient(to right, transparent, #ffffff)' }} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8ecf4', background: '#F5F8FF' }}>
                      {['Naam', 'E-mail', 'Instroom', 'Lead owner', 'Status', 'Aangemaakt', 'Geactiveerd', 'Trial resterend', "Video's", 'Event', 'Adviescall', 'Opvolging', 'Verleng trial', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'rgba(13,15,20,0.45)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAccounts.map(u => {
                      const status = getAccountStatus(u)
                      const cfg = statusConfig[status]
                      const days = trialDaysLeft(u)
                      const permanent = hasPermanentAccess(u.role)
                      const daysUrgent = days !== null && days <= 1 && !!u.activated_at
                      const videos = u.funnel?.videos_completed_count ?? 0

                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f0f3fb' }} className="hover:bg-[#F5F8FF] transition-colors">
                          {/* Naam */}
                          <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: '#0d0f14' }}>
                            {u.name || <span style={{ color: 'rgba(13,15,20,0.3)' }}>—</span>}
                          </td>

                          {/* E-mail */}
                          <td className="px-4 py-3" style={{ color: 'rgba(13,15,20,0.6)' }}>{u.email}</td>

                          {/* Instroom / herkomst */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {(() => {
                              const instroom = u.instroom ?? 'onbekend'
                              return (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={instroom === 'vermogenstest'
                                    ? { background: 'rgba(37,0,245,0.1)', color: '#2500F5' }
                                    : { background: '#f0f3fb', color: 'rgba(13,15,20,0.55)' }}
                                >
                                  {instroom === 'vermogenstest' ? 'Vermogenstest' : instroom === 'discovery' ? 'Discovery' : 'Onbekend'}
                                </span>
                              )
                            })()}
                          </td>

                          {/* Lead owner (accountmanager) — leeg = round robin */}
                          <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#0d0f14' }}>
                            {u.hubspot_owner_id
                              ? ownerName(u.hubspot_owner_id)
                              : <span style={{ color: 'rgba(13,15,20,0.55)' }}>Round robin</span>}
                          </td>

                          {/* Status badge */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ background: cfg.bg, color: cfg.color }}
                            >
                              {cfg.label}
                            </span>
                          </td>

                          {/* Aangemaakt op + hoe lang geleden */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span style={{ color: 'rgba(13,15,20,0.55)' }}>{formatDate(u.created_at)}</span>
                            {status === 'aangemaakt' && (
                              <span className="block text-[10px] mt-0.5" style={{ color: 'rgba(37,0,245,0.7)' }}>
                                {hoeLangGeleden(u.created_at)}
                              </span>
                            )}
                          </td>

                          {/* Geactiveerd op */}
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'rgba(13,15,20,0.55)' }}>
                            {u.activated_at ? formatDate(u.activated_at) : <span style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>}
                          </td>

                          {/* Trial resterend */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {permanent
                              ? <span className="font-semibold" style={{ color: '#2500F5' }}>Onbeperkt</span>
                              : !u.activated_at
                                ? <span style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>
                                : <span className="font-semibold" style={{ color: daysUrgent ? 'rgba(13,15,20,0.45)' : '#0d0f14' }}>
                                    {days === 0 ? 'Verlopen' : `${days}d`}
                                  </span>
                            }
                          </td>

                          {/* Video's X/6 */}
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: videos >= 6 ? 'rgba(37,0,245,0.1)' : '#f0f3fb',
                                color: videos >= 6 ? '#2500F5' : 'rgba(13,15,20,0.5)',
                              }}
                            >
                              {videos}/6
                            </span>
                          </td>

                          {/* Event geboekt */}
                          <td className="px-4 py-3">
                            {u.funnel?.event_booked
                              ? <span className="text-[10px] font-semibold" style={{ color: '#16a34a' }}>Geboekt</span>
                              : <span style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>
                            }
                          </td>

                          {/* Persoonlijke adviescall */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleCallBookedUpdate(u.id, !u.call_booked)}
                              className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition-opacity hover:opacity-75"
                              style={u.call_booked
                                ? { background: 'rgba(22,163,74,0.1)', color: '#16a34a' }
                                : u.call_clicked_at
                                  ? { background: 'rgba(37,0,245,0.08)', color: '#2500F5' }
                                  : { background: '#f0f3fb', color: 'rgba(13,15,20,0.45)' }}
                            >
                              {u.call_booked ? 'Geboekt' : u.call_clicked_at ? 'Geklikt' : u.call_opened_at ? 'Gezien' : 'Niet gezien'}
                            </button>
                          </td>

                          {/* Automatische opvolging */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {u.role === 'user' ? (
                              <UserFollowUpControl
                                userId={u.id}
                                actief={u.opvolging_actief}
                                compact
                                onChange={actief => setUsers(current => current.map(item =>
                                  item.id === u.id ? { ...item, opvolging_actief: actief } : item
                                ))}
                              />
                            ) : (
                              <span className="text-[10px]" style={{ color: 'rgba(13,15,20,0.35)' }}>Niet van toepassing</span>
                            )}
                          </td>

                          {/* Extend trial */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {permanent ? (
                              <span className="text-[10px]" style={{ color: 'rgba(13,15,20,0.35)' }}>Niet van toepassing</span>
                            ) : u.activated_at ? (
                              <div className="flex items-center gap-1">
                                {[3, 7].map(d => (
                                  <button
                                    key={d}
                                    onClick={() => handleExtendTrial(u.id, d)}
                                    disabled={extendLoading === u.id}
                                    className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors hover:opacity-80 disabled:opacity-40"
                                    style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
                                    title={
                                      days === 0
                                        ? `Heractiveer trial met ${d} dagen vanaf nu`
                                        : `Verleng trial met ${d} dagen`
                                    }
                                  >
                                    +{d}d
                                  </button>
                                ))}
                                {extendError?.userId === u.id ? (
                                  <span className="text-[10px] ml-1" style={{ color: '#ef4444' }}>
                                    {extendError.msg}
                                  </span>
                                ) : extendResult?.userId === u.id && (
                                  <span className="text-[10px] ml-1 font-semibold" style={{ color: '#16a34a' }}>
                                    {extendResult.reactivated ? 'Heractiveerd tot ' : 'Verlengd tot '}
                                    {new Date(extendResult.newExpiry).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>
                            )}
                          </td>

                          {/* Delete */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => { setDeleteError(null); setDeleteConfirm({ userId: u.id, email: u.email ?? u.id }) }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                              title="Gebruiker verwijderen"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-4 py-8 text-center text-xs" style={{ color: 'rgba(13,15,20,0.35)' }}>
                          Geen accounts gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <nav className="flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: '#ffffff', borderColor: '#e8ecf4' }} aria-label="Accountpagina's">
              <p className="text-xs font-medium" style={{ color: 'rgba(13,15,20,0.55)' }} aria-live="polite">
                {rangeStart}–{rangeEnd} van {filtered.length} {isFiltered ? `gevonden accounts (${accountTotal} totaal)` : 'accounts'}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAccountPage(page => Math.max(1, page - 1))}
                  disabled={activePage === 1}
                  className="inline-flex size-8 items-center justify-center rounded-lg border transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ borderColor: '#e8ecf4', color: '#2500F5', background: '#ffffff' }}
                  aria-label="Vorige accountpagina"
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
                {visiblePages.map(page => typeof page === 'number' ? (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setAccountPage(page)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-xs font-semibold transition-opacity hover:opacity-75"
                    style={page === activePage
                      ? { background: '#2500F5', color: '#ffffff' }
                      : { background: '#f0f3fb', color: 'rgba(13,15,20,0.65)' }}
                    aria-label={`Ga naar accountpagina ${page}`}
                    aria-current={page === activePage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={page} className="inline-flex size-8 items-center justify-center text-xs" style={{ color: 'rgba(13,15,20,0.4)' }} aria-hidden="true">…</span>
                ))}
                <button
                  type="button"
                  onClick={() => setAccountPage(page => Math.min(pageCount, page + 1))}
                  disabled={activePage === pageCount}
                  className="inline-flex size-8 items-center justify-center rounded-lg border transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
                  style={{ borderColor: '#e8ecf4', color: '#2500F5', background: '#ffffff' }}
                  aria-label="Volgende accountpagina"
                >
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            </nav>
          </div>
        )
      })()}

      {/* Users table */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <input
              type="text"
              placeholder="Filter op e-mail..."
              value={filterEmail}
              onChange={e => setFilterEmail(e.target.value)}
              className="rounded-xl px-3.5 py-2.5 text-sm border outline-none w-full max-w-xs"
              style={{ background: '#ffffff', borderColor: '#e8ecf4', color: '#0d0f14' }}
            />
          </div>

          <div className="rounded-2xl border overflow-hidden relative" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
            <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10" style={{ background: 'linear-gradient(to right, transparent, #ffffff)' }} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #e8ecf4', background: '#F5F8FF' }}>
                    {[
                      { key: 'email', label: tr.admin.email },
                      { key: 'activated', label: tr.admin.activated },
                      { key: 'videos', label: tr.admin.videosCompleted },
                      { key: 'days', label: tr.admin.daysLeft },
                      { key: 'whatsapp', label: tr.admin.whatsapp },
                      { key: 'bonus', label: tr.admin.bonusUnlocked },
                      { key: 'event', label: tr.admin.eventBooked },
                      { key: 'quiz', label: 'Quiz' },
                      { key: 'tags', label: 'Tags' },
                      { key: 'expand', label: '' },
                      { key: 'delete', label: '' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left text-xs font-semibold tracking-wide cursor-pointer select-none"
                        style={{ color: 'rgba(13,15,20,0.45)' }}
                        onClick={() => ['email', 'videos', 'days'].includes(col.key) && toggleSort(col.key as typeof sortField)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortField === col.key && (sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u) => {
                    const days = trialDaysLeft(u)
                    const permanent = hasPermanentAccess(u.role)
                    const isExpiredUser = !permanent && days !== null && days === 0 && !!u.activated_at
                    const isExpanded = expandedUser === u.id
                    const logs = userLogs(u.id)
                    const quizSub = quizSubmissions.find(q => q.user_id === u.id)

                    return (
                      <>
                        <tr
                          key={u.id}
                          style={{ borderBottom: '1px solid #f0f3fb' }}
                          className="hover:bg-[#F5F8FF] transition-colors"
                        >
                          <td className="px-4 py-3 font-medium" style={{ color: '#0d0f14' }}>{u.email}</td>
                          <td className="px-4 py-3" style={{ color: 'rgba(13,15,20,0.6)' }}>
                            {u.activated_at ? formatDate(u.activated_at) : <span style={{ color: 'rgba(13,15,20,0.3)' }}>{tr.admin.no}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: (u.funnel?.videos_completed_count ?? 0) >= 6 ? 'rgba(37,0,245,0.1)' : '#f0f3fb',
                                color: (u.funnel?.videos_completed_count ?? 0) >= 6 ? '#2500F5' : 'rgba(13,15,20,0.5)',
                              }}
                            >
                              {u.funnel?.videos_completed_count ?? 0}/6
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: permanent ? '#2500F5' : isExpiredUser ? '#ef4444' : days !== null && days <= 2 ? '#f59e0b' : 'rgba(13,15,20,0.6)' }}
                            >
                              {permanent ? 'Onbeperkt' : !u.activated_at ? '—' : isExpiredUser ? tr.admin.expired_label : `${days}d`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: u.whatsapp_opt_in ? '#2500F5' : 'rgba(13,15,20,0.3)' }}>
                            {u.whatsapp_opt_in ? tr.admin.yes : tr.admin.no}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: (u.funnel?.videos_completed_count ?? 0) >= 6 ? '#2500F5' : 'rgba(13,15,20,0.3)' }}>
                            {(u.funnel?.videos_completed_count ?? 0) >= 6 ? tr.admin.yes : tr.admin.no}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: u.funnel?.event_booked ? '#2500F5' : 'rgba(13,15,20,0.3)' }}>
                            {u.funnel?.event_booked ? tr.admin.yes : tr.admin.no}
                          </td>
                          <td className="px-4 py-3">
                            {quizSub ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{
                                  background: quizSub.score >= 12 ? 'rgba(37,0,245,0.1)' : quizSub.score >= 9 ? 'rgba(37,0,245,0.06)' : '#f0f3fb',
                                  color: quizSub.score >= 9 ? '#2500F5' : 'rgba(13,15,20,0.5)',
                                }}
                              >
                                {quizSub.score}/14
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const tags = userTags(u)
                              if (tags.length === 0) return <span className="text-xs" style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>
                              return (
                                <span className="flex flex-wrap gap-1">
                                  {tags.map((tag) => {
                                    const highlight = tag === 'vermogenstest'
                                    return (
                                      <span
                                        key={tag}
                                        className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                                        style={{
                                          background: highlight ? 'rgba(37,0,245,0.1)' : '#f0f3fb',
                                          color: highlight ? '#2500F5' : 'rgba(13,15,20,0.55)',
                                        }}
                                      >
                                        {tag}
                                      </span>
                                    )
                                  })}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                              className="text-xs transition-colors"
                              style={{ color: 'rgba(13,15,20,0.4)' }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => { setDeleteError(null); setDeleteConfirm({ userId: u.id, email: u.email ?? u.id }) }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                              title="Gebruiker verwijderen"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${u.id}-detail`}>
                            <td colSpan={12} className="px-4 py-3">
                              <div
                                className="rounded-xl p-4 space-y-2"
                                style={{ background: '#F5F8FF', border: '1px solid #e8ecf4' }}
                              >
                                {/* Toegang: verlengen of heractiveren */}
                                <div className="flex flex-wrap items-center gap-2 pb-3 mb-3" style={{ borderBottom: '1px solid #e8ecf4' }}>
                                  <span className="text-xs font-semibold" style={{ color: 'rgba(13,15,20,0.55)' }}>Toegang</span>
                                  {permanent ? (
                                    <span className="text-xs font-semibold" style={{ color: '#2500F5' }}>
                                      Onbeperkte toegang ({u.role})
                                    </span>
                                  ) : !u.activated_at ? (
                                    <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>
                                      Nog niet geactiveerd — de activatielink blijft geldig.
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-xs" style={{ color: isExpiredUser ? '#ef4444' : 'rgba(13,15,20,0.5)' }}>
                                        {isExpiredUser
                                          ? 'Trial verlopen'
                                          : `Nog ${days}d — loopt tot ${u.trial_expires_at ? formatDate(u.trial_expires_at) : '—'}`}
                                      </span>
                                      {[3, 7].map(d => (
                                        <button
                                          key={d}
                                          onClick={() => handleExtendTrial(u.id, d)}
                                          disabled={extendLoading === u.id}
                                          className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors hover:opacity-80 disabled:opacity-40"
                                          style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
                                        >
                                          {isExpiredUser ? `Heractiveer +${d}d` : `+${d} dagen`}
                                        </button>
                                      ))}
                                      {extendError?.userId === u.id ? (
                                        <span className="text-xs" style={{ color: '#ef4444' }}>{extendError.msg}</span>
                                      ) : extendResult?.userId === u.id && (
                                        <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>
                                          {extendResult.reactivated ? 'Heractiveerd tot ' : 'Verlengd tot '}
                                          {formatDate(extendResult.newExpiry)}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>

                                <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(13,15,20,0.55)' }}>
                                  Timeline ({logs.length} events)
                                </p>
                                {logs.length === 0 && (
                                  <p className="text-xs" style={{ color: 'rgba(13,15,20,0.3)' }}>Geen events</p>
                                )}
                                {logs.map((log) => (
                                  <div key={log.id} className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#2500F5' }} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold" style={{ color: '#0d0f14' }}>{log.event_type}</span>
                                        <span className="text-[10px]" style={{ color: 'rgba(13,15,20,0.35)' }}>
                                          {formatDateTime(log.created_at)}
                                        </span>
                                        <span
                                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                                          style={{
                                            background: log.response_status?.startsWith('2') ? 'rgba(34,197,94,0.12)' : log.response_status === 'no_endpoint' ? '#f0f3fb' : 'rgba(239,68,68,0.1)',
                                            color: log.response_status?.startsWith('2') ? '#16a34a' : log.response_status === 'no_endpoint' ? 'rgba(13,15,20,0.4)' : '#ef4444',
                                          }}
                                        >
                                          {log.response_status ?? 'pending'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                {/* Quiz results */}
                                {quizSub && (
                                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e8ecf4' }}>
                                    <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(13,15,20,0.55)' }}>
                                      Quiz — {quizSub.score}/14 juist
                                      <span className="ml-2 font-normal" style={{ color: 'rgba(13,15,20,0.35)' }}>
                                        ({formatDate(quizSub.submitted_at)})
                                      </span>
                                    </p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {QUIZ_QUESTIONS.map(q => {
                                        const ans = quizSub.answers.find(a => a.question_no === q.no)
                                        const correct = ans?.correct ?? false
                                        return (
                                          <div
                                            key={q.no}
                                            className="flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs"
                                            style={{
                                              background: correct ? 'rgba(37,0,245,0.04)' : 'rgba(239,68,68,0.04)',
                                              border: `1px solid ${correct ? 'rgba(37,0,245,0.1)' : 'rgba(239,68,68,0.1)'}`,
                                            }}
                                          >
                                            <span
                                              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5"
                                              style={{ background: correct ? '#2500F5' : '#ef4444', color: '#fff' }}
                                            >
                                              {q.no}
                                            </span>
                                            <div className="min-w-0">
                                              <p className="truncate font-medium" style={{ color: '#0d0f14', maxWidth: '240px' }}>{q.vraag}</p>
                                              {ans && (
                                                <p style={{ color: correct ? '#2500F5' : '#ef4444' }}>
                                                  {ans.chosen}: {q.opties[ans.chosen]}
                                                  {!correct && (
                                                    <span style={{ color: 'rgba(13,15,20,0.4)' }}> → {q.juist}: {q.opties[q.juist]}</span>
                                                  )}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Workflows tab */}
      {tab === 'workflows' && (
        <div className="space-y-6">

          {/* Test trigger strip */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: 'rgba(37,0,245,0.05)', border: '1px solid rgba(37,0,245,0.12)' }}>
            <div>
              <p className="text-xs font-bold" style={{ color: '#2500F5' }}>Vrije testtrigger</p>
              <p className="text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>Stuur elk van de 15 mail-codes vrij naar elk e-mailadres, zonder grendel.</p>
            </div>
            <button
              onClick={() => { setTestModal(true); setTestResult(null) }}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl shrink-0"
              style={{ background: '#2500F5', color: '#fff' }}
            >
              <Send size={12} />
              Stuur testtrigger
            </button>
          </div>

          {/* Eenmalige inhaalronde — alleen admin, alleen voor alles_gezien_c1 */}
          {isAdmin && (
            <div className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.14)' }}>
              <div>
                <p className="text-xs font-bold" style={{ color: '#b45309' }}>Inhaalronde: alles gezien</p>
                <p className="text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>
                  Eenmalig voor wie 6/6 haalde vóór de codefix en de mail nooit kreeg. Preview eerst, niets vertrekt zonder bevestiging.
                </p>
              </div>
              <button
                onClick={() => setInhaalModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl shrink-0"
                style={{ background: '#b45309', color: '#fff' }}
              >
                <MailWarning size={12} />
                Inhaalronde: alles gezien
              </button>
            </div>
          )}

          {['Activatie', 'Videos', 'Conversie', 'Retentie'].map(fase => {
            const faseWorkflows = WORKFLOWS.filter(w => w.fase === fase)
            return (
              <div key={fase}>
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'rgba(13,15,20,0.35)' }}>{fase}</p>
                <div className="space-y-2">
                  {faseWorkflows.map(wf => {
                    const cfg = webhookConfig.find(c => c.trigger_naam === wf.naam)
                    const todayLogs = triggerLog.filter(l =>
                      l.workflow_naam === wf.naam &&
                      new Date(l.created_at).toDateString() === new Date().toDateString()
                    )
                    const vandaagVerstuurd = todayLogs.filter(l => l.status === 'verstuurd').length
                    const vandaagOnderdrukt = todayLogs.filter(l => l.status === 'onderdrukt').length
                    const isActief = cfg?.actief ?? true

                    return (
                      <div
                        key={wf.naam}
                        className="flex items-start gap-4 p-4 rounded-2xl border transition-all"
                        style={{
                          background: '#ffffff',
                          borderColor: isActief ? '#e8ecf4' : '#f0f3fb',
                          opacity: isActief ? 1 : 0.6,
                        }}
                      >
                        {/* Number badge */}
                        <div
                          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                          style={{ background: isActief ? '#2500F5' : '#e8ecf4', color: isActief ? '#fff' : 'rgba(13,15,20,0.3)' }}
                        >
                          {wf.nummer}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-semibold" style={{ color: '#0d0f14' }}>{wf.label}</span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{
                                background: wf.type === 'instant' ? 'rgba(37,0,245,0.1)' : 'rgba(234,179,8,0.12)',
                                color: wf.type === 'instant' ? '#2500F5' : '#854d0e',
                              }}
                            >
                              {wf.type === 'instant' ? 'Instant' : 'Klok'}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>{wf.voorwaarde}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'rgba(13,15,20,0.35)' }}>{wf.timing} · {wf.suppressie}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
                              {vandaagVerstuurd} verstuurd vandaag
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.45)' }}>
                              {vandaagOnderdrukt} onderdrukt
                            </span>
                          </div>
                        </div>

                        {/* Manual trigger + Toggle */}
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setTriggerModal({ triggerNaam: wf.naam, label: wf.label })
                              setTriggerUserId('')
                              setTriggerResult(null)
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                            style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
                            title="Handmatig versturen naar een gebruiker"
                          >
                            <Send size={12} />
                            Verstuur
                          </button>
                          <button
                            onClick={() => handleToggleWorkflow(wf.naam, isActief)}
                            className="flex items-center gap-1.5 text-xs font-medium transition-all"
                            style={{ color: isActief ? '#2500F5' : 'rgba(13,15,20,0.3)' }}
                            aria-label={isActief ? 'Workflow uitschakelen' : 'Workflow inschakelen'}
                          >
                            {isActief
                              ? <ToggleRight size={22} />
                              : <ToggleLeft size={22} />
                            }
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Trigger-history tab */}
      {tab === 'history' && (() => {
        const now2 = new Date()
        const startOfDay = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate()).getTime()
        const startOfWeek = startOfDay - 6 * 24 * 60 * 60 * 1000

        const filtered = triggerLog.filter(l => {
          const ts = new Date(l.created_at).getTime()
          const periodeOk =
            historyFilter.periode === 'alles' ? true :
            historyFilter.periode === 'vandaag' ? ts >= startOfDay :
            ts >= startOfWeek
          const emailOk = !historyFilter.email || l.contact_email.toLowerCase().includes(historyFilter.email.toLowerCase())
          const workflowOk = !historyFilter.workflow || l.workflow_naam === historyFilter.workflow
          return periodeOk && emailOk && workflowOk
        })

        return (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#e8ecf4' }}>
                {(['vandaag', 'week', 'alles'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setHistoryFilter(f => ({ ...f, periode: p }))}
                    className="px-3 py-2 text-xs font-medium capitalize transition-all"
                    style={historyFilter.periode === p
                      ? { background: '#2500F5', color: '#fff' }
                      : { background: '#fff', color: 'rgba(13,15,20,0.55)' }
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Filter op e-mail..."
                value={historyFilter.email}
                onChange={e => setHistoryFilter(f => ({ ...f, email: e.target.value }))}
                className="rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#fff', borderColor: '#e8ecf4', color: '#0d0f14', minWidth: 180 }}
              />
              <select
                value={historyFilter.workflow}
                onChange={e => setHistoryFilter(f => ({ ...f, workflow: e.target.value }))}
                className="rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#fff', borderColor: '#e8ecf4', color: '#0d0f14' }}
              >
                <option value="">Alle workflows</option>
                {WORKFLOWS.map(w => (
                  <option key={w.naam} value={w.naam}>W{w.nummer} · {w.label}</option>
                ))}
              </select>
              <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>{filtered.length} rijen</span>
            </div>

            {/* Table */}
            <div className="rounded-2xl border overflow-hidden relative" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
            <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10" style={{ background: 'linear-gradient(to right, transparent, #ffffff)' }} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8ecf4', background: '#F5F8FF' }}>
                      {['Tijdstip', 'Workflow', 'Account', 'Status', 'Reden', 'Payload'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'rgba(13,15,20,0.45)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(log => {
                      const isExpanded = expandedPayload === log.id
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f0f3fb' }} className="hover:bg-[#F5F8FF] transition-colors align-top">
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'rgba(13,15,20,0.45)' }}>
                            {new Date(log.created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold" style={{ color: '#0d0f14' }}>W{log.workflow_nummer}</span>
                            <span className="ml-1" style={{ color: 'rgba(13,15,20,0.45)' }}>· {log.workflow_naam}</span>
                          </td>
                          <td className="px-4 py-3" style={{ color: 'rgba(13,15,20,0.55)' }}>{log.contact_email}</td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                              style={{
                                background:
                                  log.status === 'verstuurd' ? 'rgba(34,197,94,0.12)' :
                                  log.status === 'onderdrukt' ? '#f0f3fb' :
                                  log.status === 'no_endpoint' ? 'rgba(234,179,8,0.1)' :
                                  'rgba(239,68,68,0.1)',
                                color:
                                  log.status === 'verstuurd' ? '#16a34a' :
                                  log.status === 'onderdrukt' ? 'rgba(13,15,20,0.4)' :
                                  log.status === 'no_endpoint' ? '#854d0e' :
                                  '#ef4444',
                              }}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-xs truncate" style={{ color: 'rgba(13,15,20,0.4)' }}>
                            {log.reden ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedPayload(isExpanded ? null : log.id)}
                              className="text-[10px] transition-colors"
                              style={{ color: 'rgba(13,15,20,0.4)' }}
                            >
                              {isExpanded ? 'verbergen' : 'toon'}
                            </button>
                            {isExpanded && (
                              <pre
                                className="mt-2 text-[10px] leading-relaxed rounded-lg p-2 overflow-x-auto max-w-sm"
                                style={{ background: '#F5F8FF', color: '#2500F5', border: '1px solid #e8ecf4' }}
                              >
                                {JSON.stringify(log.payload_json, null, 2)}
                              </pre>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs" style={{ color: 'rgba(13,15,20,0.35)' }}>
                          Geen trigger-events gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Account-aanmaken logs tab */}
      {tab === 'account_logs' && (() => {
        const filtered = accountLogs.filter(l => {
          const emailOk = !accountLogsFilter.email || (l.email ?? '').toLowerCase().includes(accountLogsFilter.email.toLowerCase())
          const outcomeOk = !accountLogsFilter.outcome || l.outcome === accountLogsFilter.outcome
          return emailOk && outcomeOk
        })

        async function copyLink(link: string) {
          await navigator.clipboard.writeText(link)
          setCopiedLink(link)
          setTimeout(() => setCopiedLink(null), 2000)
        }

        return (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Outcome filter */}
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#e8ecf4' }}>
                {([
                  { value: '', label: 'Alles' },
                  { value: 'created', label: 'Created' },
                  { value: 'reused', label: 'Reused' },
                  { value: 'error', label: 'Error' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAccountLogsFilter(f => ({ ...f, outcome: opt.value }))}
                    className="px-3 py-2 text-xs font-medium transition-all"
                    style={accountLogsFilter.outcome === opt.value
                      ? { background: '#2500F5', color: '#fff' }
                      : { background: '#fff', color: 'rgba(13,15,20,0.55)' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Email search */}
              <input
                type="text"
                placeholder="Zoek op e-mail..."
                value={accountLogsFilter.email}
                onChange={e => setAccountLogsFilter(f => ({ ...f, email: e.target.value }))}
                className="rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ background: '#fff', borderColor: '#e8ecf4', color: '#0d0f14', minWidth: 200 }}
              />

              <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>{filtered.length} rijen</span>
            </div>

            {/* Table */}
            <div className="rounded-2xl border overflow-hidden relative" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
            <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10" style={{ background: 'linear-gradient(to right, transparent, #ffffff)' }} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8ecf4', background: '#F5F8FF' }}>
                      {['Tijdstip', 'E-mail', 'Uitkomst', 'Reden', 'HTTP', 'Payload', 'Activatielink'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'rgba(13,15,20,0.45)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(log => {
                      const isPayloadExpanded = expandedPayload === log.id
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f0f3fb' }} className="hover:bg-[#F5F8FF] transition-colors align-top">
                          {/* Tijdstip */}
                          <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'rgba(13,15,20,0.45)' }}>
                            {new Date(log.created_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>

                          {/* E-mail */}
                          <td className="px-4 py-3 font-medium" style={{ color: '#0d0f14' }}>
                            {log.email ?? <span style={{ color: 'rgba(13,15,20,0.3)' }}>—</span>}
                          </td>

                          {/* Uitkomst */}
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                              style={{
                                background:
                                  log.outcome === 'created' ? 'rgba(37,0,245,0.08)' :
                                  log.outcome === 'reused'  ? 'rgba(34,197,94,0.1)' :
                                  'rgba(239,68,68,0.1)',
                                color:
                                  log.outcome === 'created' ? '#2500F5' :
                                  log.outcome === 'reused'  ? '#16a34a' :
                                  '#ef4444',
                              }}
                            >
                              {log.outcome}
                            </span>
                          </td>

                          {/* Reden */}
                          <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: 'rgba(13,15,20,0.45)' }}>
                            {log.reden ?? <span style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>}
                          </td>

                          {/* HTTP status */}
                          <td className="px-4 py-3">
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: log.http_status < 300 ? '#16a34a' : '#ef4444' }}
                            >
                              {log.http_status}
                            </span>
                          </td>

                          {/* Payload */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedPayload(isPayloadExpanded ? null : log.id)}
                              className="text-[10px] transition-colors"
                              style={{ color: 'rgba(13,15,20,0.4)' }}
                            >
                              {isPayloadExpanded ? 'verbergen' : 'toon'}
                            </button>
                            {isPayloadExpanded && (
                              <pre
                                className="mt-2 text-[10px] leading-relaxed rounded-lg p-2 overflow-x-auto max-w-sm"
                                style={{ background: '#F5F8FF', color: '#2500F5', border: '1px solid #e8ecf4' }}
                              >
                                {JSON.stringify(log.payload_json, null, 2)}
                              </pre>
                            )}
                          </td>

                          {/* Activatielink */}
                          <td className="px-4 py-3">
                            {log.activatielink ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-[10px] truncate max-w-[140px] block"
                                  style={{ color: '#2500F5' }}
                                  title={log.activatielink}
                                >
                                  {log.activatielink.replace(/^https?:\/\/[^/]+/, '')}
                                </span>
                                <button
                                  onClick={() => copyLink(log.activatielink!)}
                                  className="shrink-0 transition-colors"
                                  style={{ color: copiedLink === log.activatielink ? '#16a34a' : 'rgba(13,15,20,0.35)' }}
                                  title="Link kopiëren"
                                >
                                  {copiedLink === log.activatielink
                                    ? <Check size={12} />
                                    : <Copy size={12} />
                                  }
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: 'rgba(13,15,20,0.25)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-xs" style={{ color: 'rgba(13,15,20,0.35)' }}>
                          Geen logs gevonden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Webhook log */}
      {tab === 'webhooks' && (
        <div className="rounded-2xl border overflow-hidden relative" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
            <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10" style={{ background: 'linear-gradient(to right, transparent, #ffffff)' }} />
          <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ borderBottom: '1px solid #e8ecf4', background: '#F5F8FF' }}>
                  {[tr.admin.timestamp, tr.admin.eventType, tr.admin.user, tr.admin.status, tr.admin.payload].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'rgba(13,15,20,0.45)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {webhookLog.map((log) => {
                  const isPayloadExpanded = expandedPayload === log.id
                  const owner = users.find(u => u.id === log.user_id)
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f0f3fb' }} className="hover:bg-[#F5F8FF] transition-colors align-top">
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'rgba(13,15,20,0.45)' }}>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: '#0d0f14' }}>{log.event_type}</td>
                      <td className="px-4 py-3" style={{ color: 'rgba(13,15,20,0.55)' }}>{owner?.email ?? log.user_id?.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{
                            background: log.response_status?.startsWith('2') ? 'rgba(34,197,94,0.12)' : log.response_status === 'no_endpoint' ? '#f0f3fb' : 'rgba(239,68,68,0.1)',
                            color: log.response_status?.startsWith('2') ? '#16a34a' : log.response_status === 'no_endpoint' ? 'rgba(13,15,20,0.35)' : '#ef4444',
                          }}
                        >
                          {log.response_status ?? 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedPayload(isPayloadExpanded ? null : log.id)}
                          className="text-[10px] transition-colors"
                          style={{ color: 'rgba(13,15,20,0.4)' }}
                        >
                          {isPayloadExpanded ? 'verbergen' : 'toon'}
                        </button>
                        {isPayloadExpanded && (
                          <pre
                            className="mt-2 text-[10px] leading-relaxed rounded-lg p-2 overflow-x-auto max-w-sm"
                            style={{ background: '#F5F8FF', color: '#2500F5', border: '1px solid #e8ecf4' }}
                          >
                            {JSON.stringify(log.payload_json, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {webhookLog.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-xs" style={{ color: 'rgba(13,15,20,0.35)' }}>
                      Nog geen webhook events
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Eenmalige inhaalronde alles-gezien */}
      {inhaalModal && isAdmin && (
        <InhaalrondeModal onClose={() => setInhaalModal(false)} />
      )}

      {/* Free-form test trigger modal */}
      {testModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(13,15,20,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !testLoading && setTestModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid #e8ecf4' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,0,245,0.08)' }}>
                  <Send size={16} style={{ color: '#2500F5' }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: '#0d0f14' }}>Vrije testtrigger</h2>
                  <p className="text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>Stuurt exact hetzelfde formaat als automatische triggers</p>
                </div>
              </div>
              <button
                onClick={() => !testLoading && setTestModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.4)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Mail-code dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'rgba(13,15,20,0.55)' }}>Mail-code</label>
              <select
                value={testCode}
                onChange={e => { setTestCode(e.target.value); setTestResult(null) }}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                style={{ background: '#f8f9fc', borderColor: '#e8ecf4', color: '#0d0f14' }}
              >
                {HUBSPOT_CODES_ORDERED.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <p className="text-xs font-mono px-1" style={{ color: 'rgba(37,0,245,0.7)' }}>{testCode}</p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'rgba(13,15,20,0.55)' }}>E-mailadres</label>
              <input
                type="email"
                value={testEmail}
                onChange={e => { setTestEmail(e.target.value); setTestResult(null) }}
                placeholder="naam@voorbeeld.be"
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                style={{ background: '#f8f9fc', borderColor: '#e8ecf4', color: '#0d0f14' }}
              />
            </div>

            {/* Naam */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'rgba(13,15,20,0.55)' }}>Naam <span style={{ color: 'rgba(13,15,20,0.3)', fontWeight: 400 }}>(optioneel)</span></label>
              <input
                type="text"
                value={testNaam}
                onChange={e => setTestNaam(e.target.value)}
                placeholder="Voornaam Achternaam"
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                style={{ background: '#f8f9fc', borderColor: '#e8ecf4', color: '#0d0f14' }}
              />
            </div>

            {/* Result feedback */}
            {testResult && (
              <p
                className="text-xs px-3 py-2 rounded-xl font-mono"
                style={{
                  background: testResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  color: testResult.ok ? '#16a34a' : '#ef4444',
                }}
              >
                {testResult.msg}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setTestModal(false)}
                disabled={testLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.65)' }}
              >
                Sluiten
              </button>
              <button
                onClick={handleTestTrigger}
                disabled={testLoading || !testEmail.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: '#2500F5', color: '#ffffff' }}
              >
                {testLoading ? 'Bezig...' : 'Verstuur test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual trigger modal */}
      {triggerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(13,15,20,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !triggerLoading && setTriggerModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid #e8ecf4' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,0,245,0.08)' }}>
                  <Send size={16} style={{ color: '#2500F5' }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold" style={{ color: '#0d0f14' }}>Handmatig versturen</h2>
                  <p className="text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>{triggerModal.label}</p>
                </div>
              </div>
              <button
                onClick={() => !triggerLoading && setTriggerModal(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.4)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* User selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'rgba(13,15,20,0.55)' }}>Kies gebruiker</label>
              <select
                value={triggerUserId}
                onChange={e => { setTriggerUserId(e.target.value); setTriggerResult(null) }}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                style={{ background: '#f8f9fc', borderColor: '#e8ecf4', color: '#0d0f14' }}
              >
                <option value="">Selecteer een gebruiker</option>
                {users
                  .slice()
                  .sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} · ` : ''}{u.email}
                    </option>
                  ))}
              </select>
            </div>

            {/* Result feedback */}
            {triggerResult && (
              <p
                className="text-xs px-3 py-2 rounded-xl"
                style={{
                  background: triggerResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  color: triggerResult.ok ? '#16a34a' : '#ef4444',
                }}
              >
                {triggerResult.msg}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setTriggerModal(null)}
                disabled={triggerLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.65)' }}
              >
                Sluiten
              </button>
              <button
                onClick={handleManualTrigger}
                disabled={triggerLoading || !triggerUserId}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: '#2500F5', color: '#ffffff' }}
              >
                {triggerLoading ? 'Bezig...' : 'Verstuur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(13,15,20,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !deleteLoading && setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid #e8ecf4' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <Trash2 size={16} style={{ color: '#ef4444' }} />
                </div>
                <h2 className="text-base font-bold" style={{ color: '#0d0f14' }}>Gebruiker verwijderen</h2>
              </div>
              <button
                onClick={() => !deleteLoading && setDeleteConfirm(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.4)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(13,15,20,0.65)' }}>
              Weet je zeker dat je <span className="font-semibold" style={{ color: '#0d0f14' }}>{deleteConfirm.email}</span> permanent wilt verwijderen?
            </p>
            <p className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>
              Dit verwijdert het account, alle sessies, video-voortgang, invites en webhook-logs. Deze actie kan niet ongedaan worden gemaakt.
            </p>

            {deleteError && (
              <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                {deleteError}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError(null) }}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.65)' }}
              >
                Annuleren
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: '#ef4444', color: '#ffffff' }}
              >
                {deleteLoading ? 'Bezig...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
