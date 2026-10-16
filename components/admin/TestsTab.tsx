'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'

export interface TestSubmission {
  id: string
  user_id: string
  submission_id: string
  lead_flow: string
  variant: 'A' | 'B' | null
  vragenset?: string | null
  assigned_advisor: string | null
  answers_labeled: Array<{ question_id: string; question: string; answer: string; value: unknown }>
  answers_raw?: unknown
  result: string | null
  result_details: (Record<string, unknown> & { verdict?: { word?: string } }) | null
  score: number | null
  extra?: Record<string, unknown> | null
  utm_source: string | null
  utm_campaign: string | null
  submitted_at: string
}

interface TestUser {
  id: string
  email?: string | null
  name?: string | null
  activated_at?: string | null
  funnel?: {
    videos_completed_count?: number | null
    all_completed_at?: string | null
    invest_avond_geclaimd?: boolean | null
  } | null
}

type TestType = 'vermogenstest' | 'inflatietest' | 'eenprocenttest'

const TEST_OPTIONS: { value: TestType; label: string }[] = [
  { value: 'vermogenstest', label: 'Vermogenstest' },
  { value: 'inflatietest', label: 'Inflatietest' },
  { value: 'eenprocenttest', label: '1%-test' },
]

const TOTAL_CORE_VIDEOS = 6

const FUNNEL_STEPS = [
  { label: 'Test ingevuld', short: 'Test ingevuld' },
  { label: 'Account aangemaakt', short: 'Account' },
  { label: 'Account geactiveerd', short: 'Geactiveerd' },
  { label: '1 video afgekeken', short: '1 video' },
  { label: `Alle ${TOTAL_CORE_VIDEOS} video's afgekeken`, short: `${TOTAL_CORE_VIDEOS} video's` },
  { label: 'Editie gekozen', short: 'Editie gekozen' },
] as const

const DETAIL_LABELS: Record<string, string> = {
  path: 'Pad',
  layer: 'Laag',
  age_class: 'Leeftijdsklasse',
  situation: 'Situatie',
  guess: 'Gok',
  guess_correct: 'Gok juist',
  wealth_band: 'Vermogensband',
  segment: 'Segment',
  strengths: 'Sterktes',
  signals: 'Signalen',
  nominalReturn: 'Nominaal rendement',
  realReturn: 'Reëel rendement',
  years: 'Looptijd',
  page_uri: 'Pagina',
  total: 'Totaal vermogen',
  investable: 'Belegbaar vermogen',
  netHome: 'Eigen woning',
  future: 'Koopkracht na looptijd',
  futurePlusOne: 'Met 1% extra rendement',
}

const EURO_KEYS = new Set(['total', 'investable', 'netHome', 'future', 'futurePlusOne'])
const PERCENT_KEYS = new Set(['nominalReturn', 'realReturn'])
const HIDDEN_DETAIL_KEYS = new Set(['verdict', 'pillars', 'building_blocks', 'building_blocks_total', 'missing_points', 'slices'])
const INFLATIE_SUMMARY_KEYS = ['total', 'investable', 'netHome', 'future', 'futurePlusOne', 'nominalReturn', 'realReturn', 'years', 'segment']

const COLOR = {
  ink: '#0d0f14',
  muted: 'rgba(13,15,20,0.55)',
  faint: 'rgba(13,15,20,0.4)',
  brand: '#2500F5',
  surface: '#F5F8FF',
  line: '#e8ecf4',
}

export function isTestFlow(flow: string): flow is TestType {
  return flow === 'vermogenstest' || flow === 'inflatietest' || flow === 'eenprocenttest'
}

const numberFormat = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 })
const euroFormat = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const percentFormat = new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 1 })

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nee'
  if (typeof value === 'number') return numberFormat.format(value)
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => `${DETAIL_LABELS[key] ?? key}: ${formatValue(v)}`)
      .join(' · ')
  }
  return String(value)
}

function formatDetail(key: string, value: unknown): string {
  if (typeof value === 'number') {
    if (EURO_KEYS.has(key)) return euroFormat.format(value)
    if (PERCENT_KEYS.has(key)) return `${percentFormat.format(value)}%`
    if (key === 'years') return `${value} jaar`
  }
  return formatValue(value)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function percentOf(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function pick(s: TestSubmission, key: string): unknown {
  const fromExtra = s.extra?.[key]
  if (fromExtra !== undefined && fromExtra !== null && fromExtra !== '') return fromExtra
  return s.result_details?.[key]
}

function resultLabel(s: TestSubmission): string | null {
  const verdict = s.result_details?.verdict?.word
  if (typeof verdict === 'string' && verdict) return verdict
  if (s.result) return s.result
  return null
}

function listMeta(s: TestSubmission): string | null {
  if (s.lead_flow === 'vermogenstest') {
    return [s.variant ? `Variant ${s.variant}` : null, s.score !== null ? `Score ${s.score}` : null].filter(Boolean).join(' · ') || null
  }
  if (s.lead_flow === 'eenprocenttest') {
    const path = pick(s, 'path')
    const layer = pick(s, 'layer')
    return [path ? `Pad ${formatValue(path)}` : null, layer ? `Laag ${formatValue(layer).replace(/^laag\s*/i, '')}` : null].filter(Boolean).join(' · ') || null
  }
  if (s.lead_flow === 'inflatietest') {
    const total = s.result_details?.total
    return typeof total === 'number' ? euroFormat.format(total) : null
  }
  return null
}

/** Per stap of de gebruiker die bereikt heeft, in dezelfde volgorde als FUNNEL_STEPS. */
function funnelReached(user: TestUser | undefined): boolean[] {
  const videos = user?.funnel?.videos_completed_count ?? 0
  return [
    true,
    Boolean(user),
    Boolean(user?.activated_at),
    videos >= 1,
    videos >= TOTAL_CORE_VIDEOS || Boolean(user?.funnel?.all_completed_at),
    Boolean(user?.funnel?.invest_avond_geclaimd),
  ]
}

function furthestStep(user: TestUser | undefined): number {
  return funnelReached(user).lastIndexOf(true)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: COLOR.faint }}>{children}</h4>
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg px-3 py-2" style={{ background: COLOR.surface }}>
      <span className="text-[11px]" style={{ color: COLOR.muted }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: emphasis ? COLOR.brand : COLOR.ink }}>{value}</span>
    </div>
  )
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: COLOR.line }} aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: COLOR.brand }} />
    </div>
  )
}

function FunnelOverview({
  counts,
  selected,
  onSelect,
}: {
  counts: number[]
  selected: number | null
  onSelect: (step: number | null) => void
}) {
  const start = counts[0] ?? 0
  return (
    <div className="flex flex-col gap-3 rounded-2xl border p-4" style={{ background: '#fff', borderColor: COLOR.line }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: COLOR.ink }}>Leadflow</h3>
        <p className="text-xs" style={{ color: COLOR.muted }}>Unieke personen. Klik op een stap om te zien wie daar blijft hangen.</p>
      </div>
      <ol className="flex flex-col gap-1">
        {FUNNEL_STEPS.map((step, i) => {
          const count = counts[i] ?? 0
          const previous = i > 0 ? counts[i - 1] ?? 0 : count
          const active = selected === i
          return (
            <li key={step.label}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : i)}
                aria-pressed={active}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#F5F8FF] md:grid-cols-[180px_1fr_64px_64px_96px]"
                style={active ? { background: COLOR.surface, boxShadow: `inset 0 0 0 1px ${COLOR.brand}` } : undefined}
              >
                <span className="text-sm font-medium" style={{ color: COLOR.ink }}>{step.label}</span>
                <span className="order-last col-span-2 md:order-none md:col-span-1"><Bar pct={percentOf(count, start)} /></span>
                <span className="text-right text-sm font-semibold tabular-nums" style={{ color: COLOR.ink }}>{count}</span>
                <span className="hidden text-right text-xs tabular-nums md:block" style={{ color: COLOR.muted }}>{percentOf(count, start)}%</span>
                <span className="hidden text-right text-xs tabular-nums md:block" style={{ color: COLOR.muted }}>
                  {i === 0 ? 'start' : `${percentOf(count, previous)}% van vorige`}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

interface Slice { id?: string; label?: string; share?: number; amount?: number; nominalReturn?: number }

function InflatieAllocation({ slices, blocksById }: { slices: Slice[]; blocksById: Map<string, number> }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Verdeling van het vermogen</SectionLabel>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: COLOR.line }}>
        <div className="hidden grid-cols-[1.6fr_1fr_100px_70px_80px] gap-4 px-3 py-2 text-[11px] md:grid" style={{ background: COLOR.surface, color: COLOR.muted }}>
          <span>Categorie</span>
          <span>Aandeel</span>
          <span className="text-right">Bedrag</span>
          <span className="text-right">Blokjes</span>
          <span className="text-right">Rendement</span>
        </div>
        <ul>
          {slices.map((slice, i) => {
            const share = (slice.share ?? 0) * 100
            const blocks = slice.id ? blocksById.get(slice.id) : undefined
            const empty = !slice.amount
            return (
              <li
                key={slice.id ?? i}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-sm first:border-t-0 md:grid-cols-[1.6fr_1fr_100px_70px_80px]"
                style={{ borderColor: COLOR.line, color: empty ? COLOR.faint : COLOR.ink }}
              >
                <span className="font-medium">{slice.label ?? slice.id}</span>
                <span className="flex items-center gap-2 md:order-none">
                  <span className="w-full"><Bar pct={share} /></span>
                  <span className="w-10 text-right text-xs tabular-nums" style={{ color: COLOR.muted }}>{percentFormat.format(share)}%</span>
                </span>
                <span className="text-right tabular-nums">{typeof slice.amount === 'number' ? euroFormat.format(slice.amount) : '—'}</span>
                <span className="text-right tabular-nums" style={{ color: COLOR.muted }}>{blocks !== undefined ? `${blocks}/10` : '—'}</span>
                <span className="text-right tabular-nums" style={{ color: COLOR.muted }}>
                  {typeof slice.nominalReturn === 'number' ? `${percentFormat.format(slice.nominalReturn)}%` : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Answers({ answers }: { answers: TestSubmission['answers_labeled'] }) {
  if (answers.length === 0) {
    return <p className="rounded-lg px-3 py-3 text-sm" style={{ background: COLOR.surface, color: COLOR.muted }}>Geen antwoorden ontvangen.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Antwoorden</SectionLabel>
      <dl className="overflow-hidden rounded-lg border" style={{ borderColor: COLOR.line }}>
        {answers.map((a, i) => (
          <div
            key={`${a.question_id}-${i}`}
            className="grid gap-1 border-t px-3 py-2 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-6"
            style={{ borderColor: COLOR.line }}
          >
            <dt className="text-sm leading-relaxed" style={{ color: COLOR.muted }}>{a.question || a.question_id}</dt>
            <dd className="text-sm font-semibold leading-relaxed" style={{ color: COLOR.ink }}>{a.answer || formatValue(a.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function SubmissionDetail({ s }: { s: TestSubmission }) {
  const details = s.result_details ?? {}
  const result = resultLabel(s)
  const pillars = Array.isArray(details.pillars) ? (details.pillars as Array<{ id?: string; label?: string; value?: number }>) : []
  const slices = s.lead_flow === 'inflatietest' && Array.isArray(details.slices) ? (details.slices as Slice[]) : []
  const signals = Array.isArray(details.signals) ? (details.signals as unknown[]).map(formatValue) : []
  const missing = pick(s, 'missing_points')
  const blocks = pick(s, 'building_blocks')
  const blocksTotal = pick(s, 'building_blocks_total')

  const blocksById = new Map<string, number>()
  for (const a of s.answers_labeled) {
    if (a.question_id.startsWith('blocks.') && typeof a.value === 'number') blocksById.set(a.question_id.slice(7), a.value)
  }
  const answers = slices.length > 0 ? s.answers_labeled.filter(a => !a.question_id.startsWith('blocks.')) : s.answers_labeled

  const summaryKeys = s.lead_flow === 'inflatietest' ? INFLATIE_SUMMARY_KEYS.filter(k => details[k] !== undefined && details[k] !== null) : []
  const otherEntries = Object.entries(details).filter(([key, v]) =>
    !HIDDEN_DETAIL_KEYS.has(key) && key !== 'signals' && !summaryKeys.includes(key) && v !== null && v !== undefined && v !== '',
  )

  return (
    <div className="flex flex-col gap-6 border-t px-4 py-5" style={{ borderColor: COLOR.line }}>
      <div className="flex flex-col gap-3">
        <SectionLabel>Resultaat</SectionLabel>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {result && <Stat label="Uitkomst" value={result} emphasis />}
          {s.score !== null && <Stat label="Score" value={String(s.score)} />}
          {s.lead_flow === 'vermogenstest' && s.variant && <Stat label="Variant" value={s.variant} />}
          {s.lead_flow === 'eenprocenttest' && (
            <>
              <Stat label="Laag" value={formatValue(pick(s, 'layer') ?? s.result)} />
              <Stat label="Pad" value={formatValue(pick(s, 'path'))} />
              <Stat
                label="Bouwstenen"
                value={blocks !== undefined && blocks !== null
                  ? `${Array.isArray(blocks) ? blocks.length : formatValue(blocks)}${blocksTotal ? ` / ${formatValue(blocksTotal)}` : ''}`
                  : '—'}
              />
              <Stat label="Leeftijd" value={formatValue(pick(s, 'age_class'))} />
            </>
          )}
          {summaryKeys.map(key => (
            <Stat key={key} label={DETAIL_LABELS[key] ?? key} value={formatDetail(key, details[key])} emphasis={key === 'futurePlusOne'} />
          ))}
          {otherEntries.map(([key, value]) => (
            <Stat key={key} label={DETAIL_LABELS[key] ?? key} value={formatDetail(key, value)} />
          ))}
        </div>

        {signals.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Signalen">
            {signals.map(signal => (
              <li key={signal} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'rgba(37,0,245,0.08)', color: COLOR.brand }}>
                {signal}
              </li>
            ))}
          </ul>
        )}

        {pillars.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {pillars.map((p, i) => (
              <div key={p.id ?? i} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: COLOR.muted }}>{p.label ?? p.id}</span>
                  <span className="font-semibold tabular-nums" style={{ color: COLOR.ink }}>{p.value ?? '—'}</span>
                </div>
                <Bar pct={Number(p.value ?? 0)} />
              </div>
            ))}
          </div>
        )}

        {Array.isArray(missing) && missing.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: COLOR.muted }}>Ontbrekende punten</span>
            <ul className="flex flex-col gap-1 text-sm leading-relaxed" style={{ color: COLOR.ink }}>
              {missing.map((point, i) => <li key={i}>{formatValue(point)}</li>)}
            </ul>
          </div>
        )}
      </div>

      {slices.length > 0 && <InflatieAllocation slices={slices} blocksById={blocksById} />}

      <Answers answers={answers} />

      <p className="text-[11px]" style={{ color: COLOR.faint }}>
        {s.utm_source || s.utm_campaign ? `UTM: ${[s.utm_source, s.utm_campaign].filter(Boolean).join(' / ')} · ` : ''}
        Inzending <code className="break-all">{s.submission_id}</code>
      </p>
    </div>
  )
}

function StageChip({ user }: { user: TestUser | undefined }) {
  const step = furthestStep(user)
  const videos = user?.funnel?.videos_completed_count ?? 0
  const label = step === 5
    ? 'Editie gekozen'
    : step >= 3
      ? `${Math.min(videos, TOTAL_CORE_VIDEOS)}/${TOTAL_CORE_VIDEOS} video's`
      : FUNNEL_STEPS[step]?.short ?? 'Onbekend'
  const done = step === 5
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={done ? { background: COLOR.brand, color: '#fff' } : { background: COLOR.surface, color: COLOR.muted, border: `1px solid ${COLOR.line}` }}
    >
      {label}
    </span>
  )
}

export function TestsTab({
  submissions,
  users,
  focusUserId,
}: {
  submissions: TestSubmission[]
  users: TestUser[]
  focusUserId?: string | null
}) {
  const testSubmissions = useMemo(() => submissions.filter(s => isTestFlow(s.lead_flow)), [submissions])
  const [testType, setTestType] = useState<TestType>('vermogenstest')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [stuckAtStep, setStuckAtStep] = useState<number | null>(null)
  const focusRef = useRef<HTMLLIElement | null>(null)

  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users])

  useEffect(() => {
    if (!focusUserId) return
    const latest = testSubmissions
      .filter(s => s.user_id === focusUserId)
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
    if (!latest) return
    setTestType(latest.lead_flow as TestType)
    setQuery('')
    setStuckAtStep(null)
    setExpanded(latest.id)
    requestAnimationFrame(() => focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [focusUserId, testSubmissions])

  const counts = useMemo(() => {
    const map: Record<TestType, number> = { vermogenstest: 0, inflatietest: 0, eenprocenttest: 0 }
    for (const s of testSubmissions) map[s.lead_flow as TestType] += 1
    return map
  }, [testSubmissions])

  const ofType = useMemo(() => testSubmissions.filter(s => s.lead_flow === testType), [testSubmissions, testType])

  const funnelCounts = useMemo(() => {
    const totals = FUNNEL_STEPS.map(() => 0)
    for (const userId of new Set(ofType.map(s => s.user_id))) {
      funnelReached(userById.get(userId)).forEach((reached, i) => { if (reached) totals[i] += 1 })
    }
    return totals
  }, [ofType, userById])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ofType
      .filter(s => stuckAtStep === null || furthestStep(userById.get(s.user_id)) === stuckAtStep)
      .filter(s => {
        if (!q) return true
        const user = userById.get(s.user_id)
        return `${user?.name ?? ''} ${user?.email ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  }, [ofType, stuckAtStep, query, userById])

  return (
    <section className="flex flex-col gap-4" aria-label="Testantwoorden">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: '#f0f3fb', border: `1px solid ${COLOR.line}` }} role="tablist" aria-label="Kies een test">
          {TEST_OPTIONS.map(opt => {
            const active = testType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setTestType(opt.value); setExpanded(null); setStuckAtStep(null) }}
                className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={active ? { background: COLOR.brand, color: '#fff' } : { color: COLOR.muted }}
              >
                {opt.label} ({counts[opt.value]})
              </button>
            )
          })}
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">Zoek op naam of e-mail</span>
          <Search size={13} className="pointer-events-none absolute left-3" style={{ color: COLOR.faint }} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Zoek op naam of e-mail..."
            className="rounded-xl border py-2 pl-8 pr-3 text-sm outline-none"
            style={{ background: '#fff', borderColor: COLOR.line, color: COLOR.ink, minWidth: 240 }}
          />
        </label>
      </div>

      <FunnelOverview counts={funnelCounts} selected={stuckAtStep} onSelect={step => { setStuckAtStep(step); setExpanded(null) }} />

      {stuckAtStep !== null && (
        <div className="flex items-center gap-2 text-sm" style={{ color: COLOR.muted }}>
          <span>
            Toont wie bleef hangen bij <strong style={{ color: COLOR.ink }}>{FUNNEL_STEPS[stuckAtStep].label}</strong> ({visible.length})
          </span>
          <button
            type="button"
            onClick={() => setStuckAtStep(null)}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: COLOR.surface, color: COLOR.brand }}
          >
            <X size={12} aria-hidden="true" /> Wis filter
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border p-6 text-center text-sm" style={{ background: '#fff', borderColor: COLOR.line, color: COLOR.muted }}>
          {stuckAtStep !== null ? 'Niemand blijft bij deze stap hangen.' : 'Nog geen inzendingen voor deze test.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(s => {
            const user = userById.get(s.user_id)
            const isOpen = expanded === s.id
            const result = resultLabel(s)
            const meta = listMeta(s)
            return (
              <li
                key={s.id}
                ref={isOpen ? focusRef : undefined}
                className="scroll-mt-4 overflow-hidden rounded-2xl border"
                style={{ background: '#fff', borderColor: isOpen ? COLOR.brand : COLOR.line }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F5F8FF]"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold" style={{ color: COLOR.ink }}>{user?.name || user?.email || 'Onbekend account'}</span>
                    <span className="truncate text-xs" style={{ color: COLOR.muted }}>
                      {user?.email ?? s.user_id} · {formatDateTime(s.submitted_at)}{s.assigned_advisor ? ` · ${s.assigned_advisor}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {meta && <span className="text-xs tabular-nums" style={{ color: COLOR.muted }}>{meta}</span>}
                    {result && (
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'rgba(37,0,245,0.1)', color: COLOR.brand }}>
                        {result}
                      </span>
                    )}
                    <StageChip user={user} />
                    {isOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                  </div>
                </button>
                {isOpen && <SubmissionDetail s={s} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
