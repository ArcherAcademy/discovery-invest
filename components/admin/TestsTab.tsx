'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'

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
}

type TestType = 'vermogenstest' | 'inflatietest' | 'eenprocenttest'

const TEST_OPTIONS: { value: TestType; label: string }[] = [
  { value: 'vermogenstest', label: 'Vermogenstest' },
  { value: 'inflatietest', label: 'Inflatietest' },
  { value: 'eenprocenttest', label: '1%-test' },
]

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
  nominalReturn: 'Nominaal rendement',
  realReturn: 'Reëel rendement',
  years: 'Jaren',
  page_uri: 'Pagina',
}

const HIDDEN_DETAIL_KEYS = new Set(['verdict', 'pillars', 'building_blocks', 'building_blocks_total', 'missing_points'])

export function isTestFlow(flow: string): flow is TestType {
  return flow === 'vermogenstest' || flow === 'inflatietest' || flow === 'eenprocenttest'
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nee'
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => `${key}: ${formatValue(v)}`)
      .join(' · ')
  }
  return String(value)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  return null
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg px-3 py-2" style={{ background: '#F5F8FF' }}>
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(13,15,20,0.45)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: '#0d0f14' }}>{value}</span>
    </div>
  )
}

function SubmissionDetail({ s }: { s: TestSubmission }) {
  const details = s.result_details ?? {}
  const pillars = Array.isArray(details.pillars) ? (details.pillars as Array<{ id?: string; label?: string; value?: number }>) : []
  const missing = pick(s, 'missing_points')
  const blocks = pick(s, 'building_blocks')
  const blocksTotal = pick(s, 'building_blocks_total')
  const detailEntries = Object.entries(details).filter(([key, v]) => !HIDDEN_DETAIL_KEYS.has(key) && v !== null && v !== undefined && v !== '')
  const result = resultLabel(s)

  return (
    <div className="flex flex-col gap-5 border-t px-4 py-4" style={{ borderColor: '#e8ecf4' }}>
      {s.lead_flow === 'eenprocenttest' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <SummaryItem label="Laag" value={formatValue(pick(s, 'layer') ?? s.result)} />
            <SummaryItem label="Pad" value={formatValue(pick(s, 'path'))} />
            <SummaryItem
              label="Bouwstenen"
              value={blocks !== undefined && blocks !== null
                ? `${Array.isArray(blocks) ? blocks.length : formatValue(blocks)}${blocksTotal ? ` / ${formatValue(blocksTotal)}` : ''}`
                : '—'}
            />
            <SummaryItem label="Leeftijd" value={formatValue(pick(s, 'age_class'))} />
          </div>
          {Array.isArray(missing) && missing.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(13,15,20,0.45)' }}>Ontbrekende punten</p>
              <ul className="flex flex-col gap-1 text-sm leading-relaxed" style={{ color: '#0d0f14' }}>
                {missing.map((point, i) => <li key={i}>{'- '}{formatValue(point)}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {s.answers_labeled.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {s.answers_labeled.map((a, i) => {
            const isBlock = s.lead_flow === 'inflatietest' && a.question_id.startsWith('blocks.') && typeof a.value === 'number'
            return (
              <li key={`${a.question_id}-${i}`} className="flex flex-col gap-1 rounded-lg px-3 py-2" style={{ background: '#F5F8FF' }}>
                <span className="text-xs leading-relaxed" style={{ color: 'rgba(13,15,20,0.55)' }}>{a.question || a.question_id}</span>
                <span className="text-sm font-semibold" style={{ color: '#0d0f14' }}>{a.answer || formatValue(a.value)}</span>
                {isBlock && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#e8ecf4' }} aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, (a.value as number) * 10))}%`, background: '#2500F5' }} />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="rounded-lg px-3 py-3 text-sm" style={{ background: '#F5F8FF', color: 'rgba(13,15,20,0.5)' }}>Geen antwoorden ontvangen.</p>
      )}

      {(result || s.score !== null || pillars.length > 0 || detailEntries.length > 0) && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(13,15,20,0.45)' }}>Resultaat</p>
          {pillars.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {pillars.map((p, i) => (
                <div key={p.id ?? i} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'rgba(13,15,20,0.6)' }}>{p.label ?? p.id}</span>
                    <span className="font-semibold" style={{ color: '#0d0f14' }}>{p.value ?? '—'}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#e8ecf4' }} aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, Number(p.value ?? 0)))}%`, background: '#2500F5' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <dl className="grid gap-x-6 gap-y-1 text-xs md:grid-cols-2">
            {result && <div className="flex gap-2"><dt style={{ color: 'rgba(13,15,20,0.5)' }}>Uitkomst</dt><dd className="font-semibold" style={{ color: '#0d0f14' }}>{result}</dd></div>}
            {s.score !== null && <div className="flex gap-2"><dt style={{ color: 'rgba(13,15,20,0.5)' }}>Score</dt><dd className="font-semibold" style={{ color: '#0d0f14' }}>{s.score}</dd></div>}
            {detailEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="shrink-0" style={{ color: 'rgba(13,15,20,0.5)' }}>{DETAIL_LABELS[key] ?? key}</dt>
                <dd className="break-words font-semibold" style={{ color: '#0d0f14' }}>{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <p className="text-[10px]" style={{ color: 'rgba(13,15,20,0.4)' }}>
        {s.utm_source || s.utm_campaign ? `UTM: ${[s.utm_source, s.utm_campaign].filter(Boolean).join(' / ')} · ` : ''}
        <code className="break-all">{s.submission_id}</code>
      </p>
    </div>
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
    setExpanded(latest.id)
    requestAnimationFrame(() => focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [focusUserId, testSubmissions])

  const counts = useMemo(() => {
    const map: Record<TestType, number> = { vermogenstest: 0, inflatietest: 0, eenprocenttest: 0 }
    for (const s of testSubmissions) map[s.lead_flow as TestType] += 1
    return map
  }, [testSubmissions])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return testSubmissions
      .filter(s => s.lead_flow === testType)
      .filter(s => {
        if (!q) return true
        const user = userById.get(s.user_id)
        return `${user?.name ?? ''} ${user?.email ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
  }, [testSubmissions, testType, query, userById])

  return (
    <section className="flex flex-col gap-4" aria-label="Testantwoorden">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: '#f0f3fb', border: '1px solid #e8ecf4' }} role="tablist" aria-label="Kies een test">
          {TEST_OPTIONS.map(opt => {
            const active = testType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setTestType(opt.value); setExpanded(null) }}
                className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={active ? { background: '#2500F5', color: '#fff' } : { color: 'rgba(13,15,20,0.55)' }}
              >
                {opt.label} ({counts[opt.value]})
              </button>
            )
          })}
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">Zoek op naam of e-mail</span>
          <Search size={13} className="pointer-events-none absolute left-3" style={{ color: 'rgba(13,15,20,0.35)' }} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Zoek op naam of e-mail..."
            className="rounded-xl border py-2 pl-8 pr-3 text-sm outline-none"
            style={{ background: '#fff', borderColor: '#e8ecf4', color: '#0d0f14', minWidth: 240 }}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border p-6 text-center text-sm" style={{ background: '#fff', borderColor: '#e8ecf4', color: 'rgba(13,15,20,0.45)' }}>
          Nog geen inzendingen voor deze test.
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
                style={{ background: '#fff', borderColor: isOpen ? '#2500F5' : '#e8ecf4' }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F5F8FF]"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold" style={{ color: '#0d0f14' }}>{user?.name || user?.email || 'Onbekend account'}</span>
                    <span className="truncate text-xs" style={{ color: 'rgba(13,15,20,0.5)' }}>
                      {user?.email ?? s.user_id} · {formatDateTime(s.submitted_at)}{s.assigned_advisor ? ` · ${s.assigned_advisor}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {meta && <span className="text-xs" style={{ color: 'rgba(13,15,20,0.55)' }}>{meta}</span>}
                    {result && (
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: 'rgba(37,0,245,0.1)', color: '#2500F5' }}>
                        {result}
                      </span>
                    )}
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
