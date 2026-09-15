'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle2, Play, Circle,
  Calendar, Trophy, Clock, X, ChevronRight, User,
    Zap, TrendingUp, BarChart2, ClipboardList,
} from 'lucide-react'
import { QUIZ_QUESTIONS } from '@/lib/quiz-data'

// ── Types ────────────────────────────────────────────────────────
interface VideoStrip {
  videoId: string
  order: number
  title: string
  status: 'not_started' | 'in_progress' | 'completed'
  progress_pct: number
  started_at: string | null
  completed_at: string | null
}

interface UserRow {
  id: string
  email: string
  name: string
  created_at: string | null
  activated_at: string | null
  last_activity_at: string | null
  ms_since_activity: number | null
  days_trial_left: number | null
  trial_expires_at: string | null
  completed_count: number
  current_video: { id: string; order: number; title: string } | null
  video_strip: VideoStrip[]
  event_booked: boolean
  all_completed_at: string | null
  invest_avond_geclaimd: boolean
  invest_avond_verschenen: boolean
  quiz_submission: { submitted_at: string; score: number; answers: { question_no: number; chosen: string; correct: boolean }[] } | null
}

interface FunnelStep { label: string; count: number }
interface VideoStat { videoId: string; order: number; title: string; dropout?: number; avg_pct?: number; started_count?: number }

interface Insights {
  total: number
  dropoutPerVideo: (VideoStat & { dropout: number })[]
  avgDepthPerVideo: (VideoStat & { avg_pct: number; started_count: number })[]
  funnelSteps: FunnelStep[]
  tempo: { avgMinutesToFirstVideo: number | null; avgMinutesToComplete: number | null; completedAll: number; within1Day: number }
  riskList: { id: string; email: string; name: string; completed_count: number; ms_since_activity: number | null; days_trial_left: number | null }[]
}

// ── Design tokens ─────────────────────────────────────────────
const COBALT    = '#2500F5'
const COBALT_08 = 'rgba(37,0,245,0.08)'
const COBALT_15 = 'rgba(37,0,245,0.15)'
const TEXT      = '#0d0f14'
const TEXT_DIM  = 'rgba(13,15,20,0.45)'
const BORDER    = '#e8ecf4'
const AMBER     = '#b45309'
const AMBER_BG  = 'rgba(180,83,9,0.08)'
const RED       = '#ef4444'
const RED_BG    = 'rgba(239,68,68,0.08)'
const GREEN     = '#16a34a'
const GREEN_BG  = 'rgba(22,163,74,0.08)'

// ── Helpers ───────────────────────────────────────────────────
function formatAge(ms: number | null): string {
  if (ms === null || ms < 0) return '—'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m geleden`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}u ${m % 60}m geleden`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}u geleden`
}

function formatDuration(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h}u ${m % 60}m`
}

function formatMinutes(min: number | null): string {
  if (min === null || min < 0) return '—'
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h < 24) return `${h}u ${m}m`
  return `${Math.floor(h / 24)}d ${h % 24}u`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nl-BE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatTimeOnly(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nl-BE', { hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function activityStyle(ms: number | null): React.CSSProperties {
  if (ms === null) return { color: TEXT_DIM }
  if (ms > 172800000) return { color: AMBER, fontWeight: 700 }
  if (ms > 86400000)  return { color: 'rgba(13,15,20,0.6)' }
  return { color: TEXT }
}

function MiniBar({ value, max, color = COBALT }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="h-1.5 rounded-full w-full" style={{ background: '#f0f3fb' }}>
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function VideoStatusDot({ s }: { s: VideoStrip }) {
  if (s.status === 'completed') {
    return (
      <div title={`V${s.order}: Voltooid`}
        className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
        style={{ background: COBALT_08 }}>
        <CheckCircle2 size={15} style={{ color: COBALT }} />
      </div>
    )
  }
  if (s.status === 'in_progress') {
    return (
      <div title={`V${s.order}: Bezig — ${s.progress_pct}%`}
        className="flex flex-col items-center justify-center w-8 h-8 rounded-full shrink-0"
        style={{ background: 'rgba(234,179,8,0.12)' }}>
        <Play size={11} style={{ color: '#ca8a04' }} />
        <span className="text-[9px] font-bold leading-none mt-0.5" style={{ color: '#ca8a04' }}>{s.progress_pct}%</span>
      </div>
    )
  }
  return (
    <div title={`V${s.order}: Niet gestart`}
      className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
      style={{ background: '#f0f3fb' }}>
      <Circle size={11} style={{ color: 'rgba(13,15,20,0.2)' }} />
    </div>
  )
}

function InsightCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: '#fff', border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(13,15,20,0.06)' }}>
      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: TEXT_DIM }}>{title}</h3>
      {children}
    </div>
  )
}

// ── IdealeKlantPanel ──────────────────────────────────────────
function IdealeKlantPanel({ user }: { user: UserRow }) {
  // Step 1: Ingelogd binnen 24u na aanmaak
  const within24h = (() => {
    if (!user.created_at || !user.activated_at) return null
    const diff = new Date(user.activated_at).getTime() - new Date(user.created_at).getTime()
    return diff <= 86400000
  })()

  const steps: { label: string; sub: string; done: boolean | null }[] = [
    {
      label: 'Ingelogd binnen 24u',
      sub: within24h === null
        ? 'Geen activatiedata beschikbaar'
        : within24h
          ? 'Geactiveerd binnen 24u na aanmaak'
          : 'Meer dan 24u na aanmaak geactiveerd',
      done: within24h,
    },
    {
      label: 'Alle 6 video\'s bekeken',
      sub: user.all_completed_at
        ? `Voltooid op ${formatDateTime(user.all_completed_at)}`
        : `${user.completed_count}/6 bekeken`,
      done: !!user.all_completed_at,
    },
    {
      label: 'Adviesgesprek geopend',
      sub: user.call_clicked_at
        ? `Boekingslink geklikt op ${formatDateTime(user.call_clicked_at)}`
        : user.call_opened_at
          ? `Callblok gezien op ${formatDateTime(user.call_opened_at)}`
          : 'Nog niet gezien',
      done: !!user.call_opened_at,
    },
    {
      label: 'Adviesgesprek geboekt',
      sub: user.call_booked_at
        ? `Geboekt op ${formatDateTime(user.call_booked_at)}`
        : user.call_clicked_at
          ? 'Boekingslink geopend, boeking nog niet bevestigd'
          : 'Nog niet geboekt',
      done: user.call_booked,
    },
  ]

  const doneCount = steps.filter(s => s.done === true).length

  const GREEN     = '#16a34a'
  const GREEN_08  = 'rgba(22,163,74,0.08)'
  const GREEN_15  = 'rgba(22,163,74,0.15)'
  const RED_08    = 'rgba(239,68,68,0.08)'
  const RED_15    = 'rgba(239,68,68,0.14)'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEXT_DIM }}>
          Ideale klant — {doneCount}/4
        </h3>
        <div
          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{
            background: doneCount === 4 ? GREEN_08 : COBALT_08,
            color: doneCount === 4 ? GREEN : COBALT,
          }}
        >
          {doneCount}/4
        </div>
      </div>

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const isNull = step.done === null
          const isDone = step.done === true
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
              style={{
                background: isNull ? '#fafbff' : isDone ? GREEN_08 : RED_08,
                border: `1px solid ${isNull ? BORDER : isDone ? GREEN_15 : RED_15}`,
              }}
            >
              {/* Status dot */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: isNull ? '#f0f3fb' : isDone ? GREEN_08 : RED_08,
                  border: `1.5px solid ${isNull ? '#d8dde8' : isDone ? GREEN_15 : RED_15}`,
                }}
              >
                {isDone ? (
                  <CheckCircle2 size={11} style={{ color: GREEN }} strokeWidth={2.5} />
                ) : (
                  <Circle size={9} style={{ color: isNull ? 'rgba(13,15,20,0.25)' : 'rgba(239,68,68,0.5)' }} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: TEXT }}>{step.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: TEXT_DIM }}>{step.sub}</p>
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── TrialExtendBox ────────────────────────────────────────────
// Verlengen vanuit het detailpaneel. Werkt voor admin én mentor: de route
// achter deze knoppen staat op requireAdminOrMentor. Is de trial al verlopen,
// dan rekent de server vanaf nu — dit is dus tegelijk de heractivatie-knop.
function TrialExtendBox({ user, onExtended }: { user: UserRow; onExtended: () => void }) {
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState('')
  const [newExpiry, setNewExpiry] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const expired = !!user.trial_expires_at && new Date(user.trial_expires_at).getTime() <= Date.now()

  async function extend(days: number) {
    if (busy || !Number.isInteger(days) || days < 1 || days > 365) {
      setError('Kies een geheel aantal dagen tussen 1 en 365.')
      return
    }
    setBusy(true)
    setError(null)
    setNewExpiry(null)
    try {
      const res = await fetch('/api/admin/extend-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, days }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(res.status === 403 ? 'Geen rechten om te verlengen.' : (data?.error ?? 'Verlengen mislukt.'))
        return
      }
      setNewExpiry(data.new_expires_at)
      setCustom('')
      onExtended()
    } catch {
      setError('Verlengen mislukt — netwerkfout.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: TEXT_DIM }}>
        {expired ? 'Trial heractiveren' : 'Trial verlengen'}
      </h3>

      <div className="px-4 py-3.5 rounded-xl space-y-3"
        style={{
          background: expired ? RED_BG : '#fafbff',
          border: `1px solid ${expired ? 'rgba(239,68,68,0.14)' : BORDER}`,
        }}>

        <p className="text-[11px] leading-relaxed" style={{ color: expired ? RED : TEXT_DIM }}>
          {expired
            ? `Trial verliep op ${formatDateTime(user.trial_expires_at)}. Verlengen zet de nieuwe vervaldatum vanaf nu, waarmee het account meteen weer werkt.`
            : `Huidige vervaldatum: ${formatDateTime(user.trial_expires_at)}.`}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {[3, 7].map(d => (
            <button
              key={d}
              onClick={() => extend(d)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: COBALT, color: '#fff' }}
              title={`${expired ? 'Heractiveer' : 'Verleng'} met ${d} dagen`}
            >
              +{d} dagen
            </button>
          ))}

          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={365}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="aantal"
              className="w-20 px-2 py-1.5 text-xs rounded-lg border outline-none"
              style={{ background: '#fff', borderColor: BORDER, color: TEXT }}
              aria-label="Aangepast aantal dagen"
            />
            <button
              onClick={() => extend(Number.parseInt(custom, 10))}
              disabled={busy || custom.trim() === ''}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: COBALT_08, color: COBALT }}
            >
              Verleng
            </button>
          </div>

          {busy && <RefreshCw size={13} className="animate-spin" style={{ color: COBALT }} />}
        </div>

        {newExpiry && (
          <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: GREEN }}>
            <CheckCircle2 size={12} />
            Nieuwe vervaldatum: {formatDateTime(newExpiry)}
          </p>
        )}
        {error && (
          <p className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: RED }}>
            <AlertTriangle size={12} />
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

// ── UserDetailSlideOver ───────────────────────────────────────
function UserDetailSlideOver({ user, onClose, onExtended }: { user: UserRow; onClose: () => void; onExtended: () => void }) {
  const now = Date.now()
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  function toggleExpand(i: number) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  // ── Build timeline ────────────────────────────────────────────
  // Each event has a numeric timestamp for strict sorting.
  // Impossible timestamps (started_at before activated_at) are detected and flagged.
  type TimelineEvent = {
    tsMs: number
    tsIso: string
    label: string
    detail?: string          // shown when expanded
    type: 'activation' | 'video_start' | 'video_complete' | 'video_stalled' | 'event' | 'all_done'
    anomaly?: string         // shown inline in amber if data is suspicious
  }

  const activationMs = user.activated_at ? new Date(user.activated_at).getTime() : null
  const events: TimelineEvent[] = []

  // 1. Activation — always first
  if (user.activated_at && activationMs) {
    events.push({
      tsMs: activationMs,
      tsIso: user.activated_at,
      label: 'Account geactiveerd',
      type: 'activation',
    })
  }

  // 2. Per-video events — start + complete/stalled
  for (const s of user.video_strip) {
    if (!s.started_at) continue

    const startMs = new Date(s.started_at).getTime()
    // Detect impossible: started before activation
    const startBeforeActivation = activationMs !== null && startMs < activationMs - 5000 // 5s grace
    const startAnomaly = startBeforeActivation
      ? `Gestart vóór activatie (datapunt onbetrouwbaar)`
      : undefined

    events.push({
      tsMs: startBeforeActivation && activationMs ? activationMs + s.order * 1000 : startMs,
      tsIso: s.started_at,
      label: `Video ${s.order} gestart`,
      detail: s.title,
      type: 'video_start',
      anomaly: startAnomaly,
    })

    if (s.status === 'completed' && s.completed_at) {
      const completeMs = new Date(s.completed_at).getTime()
      // Detect impossible: completed before started
      const completeBeforeStart = completeMs < startMs - 5000
      const watchMs = completeBeforeStart ? null : Math.max(0, completeMs - startMs)
      events.push({
        tsMs: completeBeforeStart ? startMs + 1000 : completeMs,
        tsIso: s.completed_at,
        label: `Video ${s.order} voltooid`,
        detail: watchMs !== null
          ? `${s.title} · kijktijd ~${formatDuration(watchMs)}`
          : `${s.title} · kijktijd onbekend (datapunt)`,
        type: 'video_complete',
        anomaly: completeBeforeStart ? 'Voltooitijd vóór starttijd (datapunt)' : undefined,
      })
    } else if (s.status === 'in_progress') {
      const lastMs = user.last_activity_at ? new Date(user.last_activity_at).getTime() : now
      events.push({
        tsMs: lastMs,
        tsIso: user.last_activity_at ?? s.started_at,
        label: `Video ${s.order}: gestopt op ${s.progress_pct}%`,
        detail: s.title,
        type: 'video_stalled',
      })
    }
  }

  // 3. All done milestone (only if not already covered by last video_complete)
  if (user.all_completed_at && user.completed_count === 6) {
    const allDoneMs = new Date(user.all_completed_at).getTime()
    const lastCompleteMs = events
      .filter(e => e.type === 'video_complete')
      .reduce((max, e) => Math.max(max, e.tsMs), 0)
    // Only add if timestamp differs meaningfully from last completion (>5s)
    if (Math.abs(allDoneMs - lastCompleteMs) > 5000) {
      events.push({
        tsMs: allDoneMs,
        tsIso: user.all_completed_at,
        label: 'Traject volledig afgerond',
        detail: 'Alle 6 kernvideo\'s voltooid',
        type: 'all_done',
      })
    }
  }

  // 4. Event booked — use last_activity_at as proxy if no dedicated timestamp
  if (user.event_booked) {
    const eventTs = user.last_activity_at ?? user.all_completed_at
    if (eventTs) {
      const eventMs = new Date(eventTs).getTime()
      // Only add if not already at this same ms as another event
      const isDupe = events.some(e => Math.abs(e.tsMs - eventMs) < 5000 && e.type !== 'all_done')
      if (!isDupe) {
        events.push({
          tsMs: eventMs,
          tsIso: eventTs,
          label: 'Event geboekt',
          type: 'event',
        })
      }
    }
  }

  // Sort strictly chronological — oldest first
  events.sort((a, b) => a.tsMs - b.tsMs)

  // ── KPI values ────────────────────────────────────────────────
  const msSinceActivation = activationMs ? now - activationMs : null

  // Defensively compute total watch time: only sum valid intervals
  const totalWatchMs = user.video_strip.reduce((sum, s) => {
    if (!s.started_at) return sum
    const startMs = new Date(s.started_at).getTime()
    const endIso = s.completed_at ?? (s.status === 'in_progress' ? user.last_activity_at : null)
    if (!endIso) return sum
    const endMs = new Date(endIso).getTime()
    if (endMs <= startMs) return sum // impossible interval — skip
    return sum + (endMs - startMs)
  }, 0)

  const isInactive = (user.ms_since_activity ?? 0) > 172800000

  const kpis = [
    {
      label: "Video's voltooid",
      value: `${user.completed_count}/6`,
      icon: CheckCircle2,
      highlight: user.completed_count === 6,
    },
    {
      label: 'Geschatte kijktijd',
      value: totalWatchMs > 60000 ? formatDuration(totalWatchMs) : '—',
      icon: Clock,
      highlight: false,
    },
    {
      label: 'Tijd sinds activatie',
      value: msSinceActivation ? formatAge(msSinceActivation) : '—',
      icon: Zap,
      highlight: false,
    },
    {
      label: 'Laatste activiteit',
      value: formatAge(user.ms_since_activity),
      icon: TrendingUp,
      highlight: isInactive,
    },
  ]

  // ── Timeline helpers ──────────────────────────────────────────
  function timelineIconEl(type: TimelineEvent['type']) {
    switch (type) {
      case 'activation':     return <Zap size={13} style={{ color: COBALT }} />
      case 'video_start':    return <Play size={13} style={{ color: '#ca8a04' }} />
      case 'video_complete': return <CheckCircle2 size={13} style={{ color: COBALT }} />
      case 'video_stalled':  return <AlertTriangle size={13} style={{ color: AMBER }} />
      case 'event':          return <Calendar size={13} style={{ color: COBALT }} />
      case 'all_done':       return <Trophy size={13} style={{ color: COBALT }} />
    }
  }

  function timelineDotBg(type: TimelineEvent['type']): string {
    if (type === 'video_stalled') return AMBER_BG
    if (type === 'video_complete' || type === 'all_done' || type === 'event' || type === 'activation') return COBALT_08
    return 'rgba(234,179,8,0.1)'
  }

  function timelineDotBorder(type: TimelineEvent['type'], anomaly?: string): string {
    if (anomaly) return AMBER
    if (type === 'video_stalled') return AMBER
    if (type === 'video_complete' || type === 'all_done') return COBALT_15
    return BORDER
  }

  function timelineLineColor(type: TimelineEvent['type']): string {
    if (type === 'video_stalled') return 'rgba(180,83,9,0.3)'
    if (type === 'video_complete' || type === 'all_done') return COBALT_15
    return BORDER
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(13,15,20,0.3)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: 'min(560px, 100vw)',
          background: '#fff',
          borderLeft: `1px solid ${BORDER}`,
          boxShadow: '-12px 0 40px rgba(13,15,20,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: COBALT_08 }}>
              <User size={17} style={{ color: COBALT }} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: TEXT }}>{user.name || user.email}</p>
              {user.name && <p className="text-xs mt-0.5" style={{ color: TEXT_DIM }}>{user.email}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {user.event_booked && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: COBALT_08, color: COBALT }}>
                    <Calendar size={9} />Event geboekt
                  </span>
                )}
                {user.trial_expires_at && (() => {
                  // Verlopen wordt apart getoond: days_trial_left klemt op 0, dus
                  // zonder deze check ziet een verlopen account eruit als "0d resterend".
                  const trialExpired = new Date(user.trial_expires_at).getTime() <= now
                  const urgent = (user.days_trial_left ?? 99) <= 2
                  return (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: trialExpired ? RED_BG : urgent ? AMBER_BG : '#f0f3fb',
                        color: trialExpired ? RED : urgent ? AMBER : TEXT_DIM,
                      }}>
                      {trialExpired ? 'Trial verlopen' : `${user.days_trial_left}d resterend`}
                    </span>
                  )
                })()}
                {isInactive && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: AMBER_BG, color: AMBER }}>
                    Inactief {formatAge(user.ms_since_activity)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0"
            style={{ background: '#f0f3fb', color: TEXT_DIM }}>
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Ideale-klant funnel */}
          <IdealeKlantPanel user={user} />

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {kpis.map(k => (
              <div key={k.label} className="p-4 rounded-2xl"
                style={{
                  background: k.highlight ? COBALT_08 : '#fafbff',
                  border: `1px solid ${k.highlight ? COBALT_15 : BORDER}`,
                }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <k.icon size={11} style={{ color: k.highlight ? COBALT : TEXT_DIM }} />
                  <p className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: k.highlight ? COBALT : TEXT_DIM }}>{k.label}</p>
                </div>
                <p className="text-xl font-extrabold leading-none"
                  style={{ color: k.highlight ? COBALT : TEXT }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Key timestamps */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Geactiveerd op', value: formatDateTime(user.activated_at) },
              { label: 'Laatste activiteit', value: formatDateTime(user.last_activity_at) },
              { label: 'Trial verloopt', value: formatDateTime(user.trial_expires_at) },
              ...(user.all_completed_at ? [{ label: 'Traject voltooid', value: formatDateTime(user.all_completed_at) }] : []),
            ].map(item => (
              <div key={item.label} className="px-3 py-2.5 rounded-xl"
                style={{ background: '#fafbff', border: `1px solid ${BORDER}` }}>
                <p className="text-[10px] font-medium mb-0.5" style={{ color: TEXT_DIM }}>{item.label}</p>
                <p className="text-xs font-semibold" style={{ color: TEXT }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Trial verlengen / heractiveren */}
          <TrialExtendBox user={user} onExtended={onExtended} />

          {/* Vertical timeline — story in time */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: TEXT_DIM }}>
              Tijdlijn
            </h3>

            {events.length === 0 ? (
              <p className="text-xs" style={{ color: TEXT_DIM }}>Nog geen activiteit geregistreerd.</p>
            ) : (
              <div className="relative ml-1">
                {events.map((ev, i) => {
                  const isLast = i === events.length - 1
                  const isStalled = ev.type === 'video_stalled'
                  const isExpanded = expandedItems.has(i)
                  const hasDetail = !!(ev.detail || ev.anomaly)

                  return (
                    <div key={i} className="flex gap-4 relative">
                      {/* Vertical line between dots */}
                      {!isLast && (
                        <div className="absolute left-[15px] top-8 w-px"
                          style={{
                            bottom: 0,
                            background: timelineLineColor(ev.type),
                          }} />
                      )}

                      {/* Dot */}
                      <div className="relative z-10 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: timelineDotBg(ev.type),
                          border: `1.5px solid ${timelineDotBorder(ev.type, ev.anomaly)}`,
                        }}>
                        {timelineIconEl(ev.type)}
                      </div>

                      {/* Content */}
                      <div className={`flex-1 pb-6 min-w-0 ${isLast ? 'pb-2' : ''}`}>
                        <button
                          className="w-full text-left"
                          onClick={() => hasDetail && toggleExpand(i)}
                          style={{ cursor: hasDetail ? 'pointer' : 'default' }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold leading-snug"
                                style={{ color: isStalled ? AMBER : TEXT }}>
                                {ev.label}
                              </p>
                              {ev.anomaly && (
                                <p className="text-[10px] mt-0.5" style={{ color: AMBER }}>
                                  {ev.anomaly}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right flex items-start gap-1.5">
                              <div>
                                <p className="text-[10px] font-medium" style={{ color: TEXT_DIM }}>
                                  {formatDateShort(ev.tsIso)}
                                </p>
                                <p className="text-[10px]" style={{ color: TEXT_DIM }}>
                                  {formatTimeOnly(ev.tsIso)}
                                </p>
                              </div>
                              {hasDetail && (
                                <ChevronRight
                                  size={12}
                                  className="mt-0.5 transition-transform"
                                  style={{
                                    color: TEXT_DIM,
                                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && ev.detail && (
                          <p className="mt-1.5 text-[10px] leading-relaxed px-3 py-2 rounded-lg"
                            style={{ background: '#f8f9fc', color: TEXT_DIM, border: `1px solid ${BORDER}` }}>
                            {ev.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Trailing inactivity marker — only when not completed */}
                {user.completed_count < 6 && (user.ms_since_activity ?? 0) > 3600000 && (
                  <div className="flex gap-4 items-center mt-1">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: AMBER_BG, border: `1.5px dashed ${AMBER}` }}>
                      <Clock size={12} style={{ color: AMBER }} />
                    </div>
                    <p className="text-xs font-semibold" style={{ color: AMBER }}>
                      Nu: {formatAge(user.ms_since_activity)} geen activiteit
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quiz results */}
          {user.quiz_submission ? (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: TEXT_DIM }}>
                Quiz
              </h3>
              {/* Score header */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
                style={{ background: COBALT_08, border: `1px solid ${COBALT_15}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: COBALT }}>
                  <ClipboardList size={14} color="#fff" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: COBALT }}>
                    {user.quiz_submission.score}/14 juist
                    <span className="ml-1.5 font-normal text-[10px]" style={{ color: 'rgba(37,0,245,0.6)' }}>
                      ({Math.round((user.quiz_submission.score / 14) * 100)}%)
                    </span>
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(13,15,20,0.4)' }}>
                    Ingediend op {formatDateTime(user.quiz_submission.submitted_at)}
                  </p>
                </div>
                {/* Score bar */}
                <div className="w-20 shrink-0">
                  <MiniBar value={user.quiz_submission.score} max={14} />
                </div>
              </div>
              {/* Per-question breakdown */}
              <div className="space-y-1.5">
                {QUIZ_QUESTIONS.map(q => {
                  const ans = user.quiz_submission!.answers.find(a => a.question_no === q.no)
                  const correct = ans?.correct ?? false
                  const chosen = ans?.chosen as keyof typeof q.opties | undefined
                  return (
                    <div key={q.no}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                      style={{
                        background: correct ? 'rgba(37,0,245,0.04)' : 'rgba(239,68,68,0.04)',
                        border: `1px solid ${correct ? COBALT_15 : 'rgba(239,68,68,0.12)'}`,
                      }}>
                      {/* Number */}
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                        style={{ background: correct ? COBALT : '#ef4444', color: '#fff' }}>
                        {q.no}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium leading-snug" style={{ color: TEXT }}>{q.vraag}</p>
                        {ans && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                              style={{
                                background: correct ? COBALT_08 : 'rgba(239,68,68,0.1)',
                                color: correct ? COBALT : '#ef4444',
                              }}>
                              {ans.chosen}: {chosen ? q.opties[chosen] : '—'}
                            </span>
                            {!correct && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                                style={{ background: COBALT_08, color: COBALT }}>
                                Juist: {q.juist}: {q.opties[q.juist]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: TEXT_DIM }}>Quiz</h3>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: '#f8f9fc', border: `1px solid ${BORDER}` }}>
                <ClipboardList size={14} style={{ color: TEXT_DIM }} />
                <p className="text-xs" style={{ color: TEXT_DIM }}>Nog niet ingevuld.</p>
              </div>
            </div>
          )}

          {/* Per-video status grid — summary only, no date duplication */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: TEXT_DIM }}>
              Per video
            </h3>
            <div className="space-y-2">
              {user.video_strip.map(s => {
                const statusColor = s.status === 'completed' ? COBALT : s.status === 'in_progress' ? '#ca8a04' : TEXT_DIM
                const statusBg    = s.status === 'completed' ? COBALT_08 : s.status === 'in_progress' ? 'rgba(234,179,8,0.1)' : '#f0f3fb'
                const statusLabel = s.status === 'completed' ? 'Voltooid' : s.status === 'in_progress' ? `Bezig` : 'Niet gezien'

                // Defensively compute watchMs
                const startMs = s.started_at ? new Date(s.started_at).getTime() : null
                const endMs = s.completed_at ? new Date(s.completed_at).getTime()
                  : s.status === 'in_progress' && user.last_activity_at ? new Date(user.last_activity_at).getTime()
                  : null
                const watchMs = startMs && endMs && endMs > startMs ? endMs - startMs : null

                return (
                  <div key={s.videoId} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: '#fafbff', border: `1px solid ${BORDER}` }}>
                    {/* Number badge */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: statusBg, color: statusColor }}>
                      {s.order}
                    </div>
                    {/* Title + progress */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight truncate" style={{ color: TEXT }}>{s.title}</p>
                      {s.status !== 'not_started' && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1">
                            <MiniBar value={s.progress_pct} max={100} color={statusColor} />
                          </div>
                          <span className="text-[10px] font-semibold shrink-0" style={{ color: statusColor }}>
                            {s.progress_pct}%
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Right col: status + watchtime */}
                    <div className="shrink-0 text-right space-y-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg block"
                        style={{ background: statusBg, color: statusColor }}>
                        {statusLabel}
                      </span>
                      {watchMs && (
                        <p className="text-[10px]" style={{ color: TEXT_DIM }}>~{formatDuration(watchMs)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────
type FilterStatus = 'all' | 'bezig' | 'voltooid' | 'inactief'

export function VoortgangTab() {
  const [data, setData] = useState<{ userRows: UserRow[]; insights: Insights } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/voortgang')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Herlaad zonder de laad-spinner: die vervangt de hele tab en zou het
  // openstaande detailpaneel sluiten. Ververst ook de geselecteerde gebruiker,
  // zodat badge en vervaldatum meteen omslaan na een verlenging.
  const refreshSilent = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/voortgang')
      if (!res.ok) return
      const fresh = (await res.json()) as { userRows: UserRow[]; insights: Insights }
      setData(fresh)
      setSelectedUser(prev => (prev ? fresh.userRows.find(r => r.id === prev.id) ?? prev : prev))
    } catch {
      // Stil falen: de verlenging zelf is al bevestigd door de route.
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw size={20} className="animate-spin" style={{ color: COBALT }} />
        <span className="ml-3 text-sm" style={{ color: TEXT_DIM }}>Voortgang laden...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-sm" style={{ color: '#ef4444' }}>{error ?? 'Geen data'}</p>
        <button onClick={load} className="text-xs px-4 py-2 rounded-xl font-semibold" style={{ background: COBALT_08, color: COBALT }}>
          Opnieuw proberen
        </button>
      </div>
    )
  }

  const { userRows, insights } = data
  const maxDropout = Math.max(...insights.dropoutPerVideo.map(d => d.dropout), 1)
  const funnelMax = insights.funnelSteps[0]?.count ?? 1

  const filtered = userRows.filter(u => {
    const msAge = u.ms_since_activity ?? (u.last_activity_at ? now - new Date(u.last_activity_at).getTime() : null)
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'bezig'    ? u.completed_count > 0 && u.completed_count < 6 :
      filter === 'voltooid' ? u.completed_count === 6 :
      filter === 'inactief' ? (msAge ?? 0) > 86400000 && u.completed_count < 6 : true
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? '').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const FILTERS: { id: FilterStatus; label: string }[] = [
    { id: 'all',      label: 'Alle' },
    { id: 'bezig',    label: 'Bezig' },
    { id: 'voltooid', label: 'Voltooid' },
    { id: 'inactief', label: 'Inactief >24u' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold" style={{ color: TEXT }}>Voortgang & analyse</h2>
          <p className="text-xs mt-0.5" style={{ color: TEXT_DIM }}>
            {insights.total} geactiveerde gebruiker{insights.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: COBALT_08, color: COBALT }}
        >
          <RefreshCw size={12} />
          Verversen
        </button>
      </div>

      {/* ── DEEL B: Per-user table ────���───────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, boxShadow: '0 1px 4px rgba(13,15,20,0.06)' }}>

        {/* Filters + search */}
        <div className="p-4 flex items-center gap-3 flex-wrap" style={{ background: '#fff', borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex gap-1 p-1 rounded-xl shrink-0" style={{ background: '#f0f3fb' }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="px-3 py-1 text-xs font-medium rounded-lg transition-all"
                style={filter === f.id ? { background: COBALT, color: '#fff' } : { color: TEXT_DIM }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op naam of e-mail..."
            className="flex-1 min-w-[180px] px-3 py-1.5 text-xs rounded-xl border outline-none"
            style={{ background: '#fafbff', borderColor: BORDER, color: TEXT }}
          />
          <span className="text-xs shrink-0" style={{ color: TEXT_DIM }}>
            {filtered.length} gebruiker{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs" style={{ color: TEXT_DIM, background: '#fafbff' }}>
            Geen gebruikers gevonden
          </div>
        ) : (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {filtered.map(u => {
              const msAge = u.ms_since_activity
              const isRisk = (msAge ?? 0) > 172800000 && u.completed_count < 6
              const isWarning = (msAge ?? 0) > 86400000 && !isRisk && u.completed_count < 6

              return (
                <button
                  key={u.id}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[#fafbff] group"
                  style={{ borderBottom: `1px solid ${BORDER}`, background: isRisk ? '#fffbeb' : '#fff' }}
                  onClick={() => setSelectedUser(u)}
                >
                  {/* User info */}
                  <div className="w-40 shrink-0 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: TEXT }}>{u.name || u.email}</p>
                    {u.name && <p className="text-[10px] truncate" style={{ color: TEXT_DIM }}>{u.email}</p>}
                  </div>

                  {/* Video status dots — bigger, more prominent */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.video_strip.map(s => <VideoStatusDot key={s.videoId} s={s} />)}
                  </div>

                  {/* Progress bar + count */}
                  <div className="flex items-center gap-2 w-24 shrink-0">
                    <span className="text-xs font-bold shrink-0"
                      style={{ color: u.completed_count === 6 ? COBALT : TEXT }}>
                      {u.completed_count}/6
                    </span>
                    <div className="flex-1">
                      <MiniBar value={u.completed_count} max={6} />
                    </div>
                  </div>

                  {/* Inactivity — prominent when at risk */}
                  <div className="flex-1 min-w-0">
                    {msAge !== null ? (
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-lg"
                        style={{
                          background: isRisk ? AMBER_BG : isWarning ? 'rgba(13,15,20,0.05)' : 'transparent',
                          color: isRisk ? AMBER : isWarning ? 'rgba(13,15,20,0.5)' : TEXT_DIM,
                        }}
                      >
                        {formatAge(msAge)}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: TEXT_DIM }}>—</span>
                    )}
                  </div>

                  {/* Trial + event */}
                  <div className="flex items-center gap-3 shrink-0">
                  {u.trial_expires_at && (() => {
                    const trialExpired = new Date(u.trial_expires_at).getTime() <= now
                    const urgent = (u.days_trial_left ?? 99) <= 1
                    return (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg"
                        style={{
                          background: trialExpired ? RED_BG : urgent ? AMBER_BG : COBALT_08,
                          color: trialExpired ? RED : urgent ? AMBER : COBALT,
                        }}>
                        {trialExpired ? 'Verlopen' : `${u.days_trial_left}d`}
                      </span>
                    )
                  })()}
                    {u.event_booked && (
                      <Calendar size={12} style={{ color: COBALT }} />
                    )}
                  </div>

                  {/* Arrow hint */}
                  <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: TEXT_DIM }} />
                </button>
              )
            })}
          </div>
        )}

        {/* Table legend */}
        <div className="px-4 py-2.5 flex items-center gap-4 text-[10px]" style={{ background: '#fafbff', borderTop: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: COBALT_08 }}>
              <CheckCircle2 size={9} style={{ color: COBALT }} />
            </div>
            <span style={{ color: TEXT_DIM }}>Voltooid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.12)' }}>
              <Play size={9} style={{ color: '#ca8a04' }} />
            </div>
            <span style={{ color: TEXT_DIM }}>Bezig</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#f0f3fb' }}>
              <Circle size={9} style={{ color: 'rgba(13,15,20,0.2)' }} />
            </div>
            <span style={{ color: TEXT_DIM }}>Niet gestart</span>
          </div>
          <span style={{ color: TEXT_DIM }}>· Klik op een rij om de volledige tijdlijn te openen</span>
        </div>
      </div>

      {/* ── DEEL A: Aggregated Insights ──────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* 1. Dropout per video */}
        <InsightCard title="Afhaak per video">
          <div className="space-y-3">
            {insights.dropoutPerVideo.map(v => (
              <div key={v.videoId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate max-w-[180px]" style={{ color: TEXT }}>V{v.order} · {v.title}</span>
                  <span className="text-xs font-bold shrink-0 ml-2" style={{ color: v.dropout > 0 ? COBALT : TEXT_DIM }}>{v.dropout}</span>
                </div>
                <MiniBar value={v.dropout} max={maxDropout} color={v.dropout === maxDropout && v.dropout > 0 ? AMBER : COBALT} />
              </div>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: TEXT_DIM }}>Aantal gestopt bij deze video (hoogste bereikt, niet verder gegaan)</p>
        </InsightCard>

        {/* 2. Gem. kijkdiepte */}
        <InsightCard title="Gemiddelde kijkdiepte per video">
          <div className="space-y-3">
            {insights.avgDepthPerVideo.map(v => (
              <div key={v.videoId}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate max-w-[180px]" style={{ color: TEXT }}>V{v.order} · {v.title}</span>
                  <span className="text-xs font-bold shrink-0 ml-2"
                    style={{ color: v.avg_pct < 50 && v.started_count > 0 ? AMBER : TEXT }}>
                    {v.started_count > 0 ? `${v.avg_pct}%` : '—'}
                  </span>
                </div>
                {v.started_count > 0
                  ? <MiniBar value={v.avg_pct} max={100} color={v.avg_pct < 50 ? AMBER : COBALT} />
                  : <div className="h-1.5 rounded-full" style={{ background: '#f0f3fb' }} />
                }
                <p className="text-[10px] mt-0.5" style={{ color: TEXT_DIM }}>{v.started_count} begonnen</p>
              </div>
            ))}
          </div>
        </InsightCard>

        {/* 3. Funnel */}
        <InsightCard title="Conversietrechter">
          <div className="space-y-2">
            {insights.funnelSteps.map((step, i) => {
              const pct = funnelMax === 0 ? 0 : Math.round((step.count / funnelMax) * 100)
              const isKey = step.label === 'Geactiveerd' || step.label === 'Event geboekt' || step.label.endsWith('voltooid')
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <p className="text-[10px] font-medium leading-tight" style={{ color: isKey ? TEXT : TEXT_DIM }}>{step.label}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 rounded-full overflow-hidden" style={{ background: '#f0f3fb' }}>
                      <div className="h-4 rounded-full transition-all" style={{ width: `${pct}%`, background: isKey ? COBALT : 'rgba(37,0,245,0.3)' }} />
                    </div>
                  </div>
                  <div className="w-14 text-right shrink-0">
                    <span className="text-xs font-bold" style={{ color: isKey ? TEXT : TEXT_DIM }}>{step.count}</span>
                    <span className="text-[10px] ml-1" style={{ color: TEXT_DIM }}>{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </InsightCard>

        {/* 4. Tempo */}
        <InsightCard title="Tempo en doorloop">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Gem. tijd tot eerste video', value: formatMinutes(insights.tempo.avgMinutesToFirstVideo), icon: Play },
              { label: 'Gem. tijd tot 6/6 voltooid',  value: formatMinutes(insights.tempo.avgMinutesToComplete),  icon: Trophy },
              { label: 'Hebben alles gezien',          value: String(insights.tempo.completedAll),                 icon: CheckCircle2 },
              { label: 'Alles binnen 1 dag',           value: String(insights.tempo.within1Day),                   icon: Clock },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-xl" style={{ background: '#fafbff', border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <item.icon size={12} style={{ color: COBALT }} />
                  <p className="text-[10px] font-medium leading-tight" style={{ color: TEXT_DIM }}>{item.label}</p>
                </div>
                <p className="text-lg font-bold" style={{ color: TEXT }}>{item.value}</p>
              </div>
            ))}
          </div>
        </InsightCard>
      </div>

      {/* 5. Risk list */}
      {insights.riskList.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#fffbeb', border: '1px solid rgba(180,83,9,0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: AMBER }} />
            <h3 className="text-xs font-bold" style={{ color: AMBER }}>
              Inactiviteitsrisico: {insights.riskList.length} gebruiker{insights.riskList.length !== 1 ? 's' : ''} stil &gt;24u
            </h3>
          </div>
          <div className="space-y-2">
            {insights.riskList.map(u => (
              <button
                key={u.id}
                className="w-full flex items-center gap-3 text-xs text-left hover:bg-amber-50 rounded-xl px-2 py-1.5 transition-colors"
                onClick={() => setSelectedUser(userRows.find(r => r.id === u.id) ?? null)}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-semibold" style={{ color: TEXT }}>{u.name || u.email}</span>
                  {u.name && <span className="ml-1.5" style={{ color: TEXT_DIM }}>{u.email}</span>}
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: COBALT_08, color: COBALT }}>{u.completed_count}/6 video&apos;s</span>
                <span className="shrink-0 font-bold" style={{ color: AMBER }}>{formatAge(u.ms_since_activity)}</span>
                {u.days_trial_left !== null && (
                  <span className="shrink-0 text-[10px]" style={{ color: TEXT_DIM }}>{u.days_trial_left}d resterend</span>
                )}
                <ChevronRight size={12} style={{ color: AMBER }} className="shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slide-over detail panel */}
      {selectedUser && (
        <UserDetailSlideOver
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onExtended={refreshSilent}
        />
      )}
    </div>
  )
}
