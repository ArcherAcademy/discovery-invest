'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/components/app-context'
import { QUIZ_QUESTIONS, type QuizOption } from '@/lib/quiz-data'
import type { DemoQuizSubmission } from '@/lib/types'
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react'

const COBALT = '#2500F5'
const TOTAL = QUIZ_QUESTIONS.length

type Phase = 'quiz' | 'submitting' | 'result'

export default function QuizPage() {
  const { allCoreCompleted } = useApp()
  const router = useRouter()

  // Block access if not 6/6
  useEffect(() => {
    if (!allCoreCompleted) router.replace('/traject')
  }, [allCoreCompleted, router])

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, QuizOption>>({})
  const [phase, setPhase] = useState<Phase>('quiz')
  const [result, setResult] = useState<DemoQuizSubmission | null>(null)
  const [officialResult, setOfficialResult] = useState<DemoQuizSubmission | null>(null)
  const [unofficial, setUnofficial] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On mount: check if the user already submitted
  useEffect(() => {
    fetch('/api/quiz')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.submission) {
          setResult(data.submission as DemoQuizSubmission)
          setOfficialResult(data.submission as DemoQuizSubmission)
          setPhase('result')
        }
      })
      .catch(() => null)
  }, [])

  const q = QUIZ_QUESTIONS[current]
  const chosen = answers[q.no]

  function select(opt: QuizOption) {
    setAnswers(prev => ({ ...prev, [q.no]: opt }))
  }

  function next() {
    if (current < TOTAL - 1) setCurrent(c => c + 1)
  }
  function prev() {
    if (current > 0) setCurrent(c => c - 1)
  }

  async function submit() {
    // All questions must be answered
    const unanswered = QUIZ_QUESTIONS.filter(q => !answers[q.no])
    if (unanswered.length > 0) {
      setCurrent(QUIZ_QUESTIONS.findIndex(q => !answers[q.no]))
      return
    }
    setPhase('submitting')
    setError(null)
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Er ging iets mis.')
      setResult(data.submission as DemoQuizSubmission)
      if (!data.unofficial && !officialResult) {
        setOfficialResult(data.submission as DemoQuizSubmission)
      }
      setUnofficial(data.unofficial ?? false)
      setPhase('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis.')
      setPhase('quiz')
    }
  }

  function retake() {
    setAnswers({})
    setCurrent(0)
    setResult(null)
    setUnofficial(false)
    setPhase('quiz')
  }

  const answeredCount = Object.keys(answers).length

  if (!allCoreCompleted) return null

  // ── RESULT SCREEN ──────────────────────────────────────────
  if (phase === 'result' && result) {
    const score = result.score
    const pct = Math.round((score / TOTAL) * 100)
    const excellent = score >= 12
    const good = score >= 9

    return (
      <div className="max-w-2xl mx-auto pb-16 space-y-6">

        {/* Unofficial banner */}
        {unofficial && officialResult && (
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(239,170,0,0.08)', border: '1px solid rgba(239,170,0,0.25)' }}
          >
            <span className="text-sm shrink-0" style={{ color: '#b07d00' }}>!</span>
            <p className="text-sm" style={{ color: '#7a5600' }}>
              Dit is een oefenronde — je score wordt niet opgeslagen.
              Je officiële score blijft <strong>{officialResult.score}/{TOTAL}</strong>.
            </p>
          </div>
        )}

        {/* Score card */}
        <div
          className="rounded-2xl px-8 py-8 text-center"
          style={{ background: '#f0f3fb', border: '1px solid #e8ecf4' }}
        >
          <p className="text-xs font-bold tracking-[0.15em] mb-3" style={{ color: COBALT }}>
            RESULTAAT
          </p>
          <div
            className="inline-flex items-end gap-1 mb-2"
          >
            <span className="text-6xl font-extrabold tabular-nums" style={{ color: COBALT }}>{score}</span>
            <span className="text-2xl font-bold pb-2" style={{ color: 'rgba(13,15,20,0.4)' }}>/{TOTAL}</span>
          </div>
          <p className="text-lg font-bold mb-1" style={{ color: '#0d0f14' }}>
            {excellent
              ? 'Uitstekend! Je hebt de stof echt door.'
              : good
              ? 'Goed gedaan! Je begrijpt de kern goed.'
              : 'Goed begin. Kijk de video\'s nog eens terug.'}
          </p>
          <p className="text-sm" style={{ color: 'rgba(13,15,20,0.5)' }}>
            {pct}% juist beantwoord
          </p>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-3">
          <p className="text-xs font-bold tracking-[0.15em]" style={{ color: 'rgba(13,15,20,0.4)' }}>
            PER VRAAG
          </p>
          {QUIZ_QUESTIONS.map((q) => {
            const ans = result.answers.find(a => a.question_no === q.no)
            const isCorrect = ans?.correct ?? false
            const chosenLabel = ans ? q.opties[ans.chosen] : null

            return (
              <div
                key={q.no}
                className="rounded-xl p-4"
                style={{
                  background: isCorrect ? 'rgba(37,0,245,0.03)' : 'rgba(239,68,68,0.04)',
                  border: `1px solid ${isCorrect ? 'rgba(37,0,245,0.12)' : 'rgba(239,68,68,0.12)'}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isCorrect
                      ? <CheckCircle2 size={16} style={{ color: COBALT }} />
                      : <XCircle size={16} style={{ color: '#ef4444' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold mb-1" style={{ color: '#0d0f14' }}>
                      V{q.no}: {q.vraag}
                    </p>
                    {!isCorrect && chosenLabel && (
                      <p className="text-xs mb-0.5" style={{ color: '#ef4444' }}>
                        Jouw antwoord: {chosenLabel}
                      </p>
                    )}
                    {!isCorrect && (
                      <p className="text-xs font-medium" style={{ color: COBALT }}>
                        Juist antwoord: {q.opties[q.juist]}
                      </p>
                    )}
                    {isCorrect && (
                      <p className="text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>
                        {q.opties[q.juist]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={retake}
          className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-opacity hover:opacity-80"
          style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.6)', border: '1px solid #e8ecf4' }}
        >
          <RotateCcw size={14} />
          Opnieuw doen
        </button>
      </div>
    )
  }

  // ── QUIZ SCREEN ────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold tracking-[0.15em] mb-1" style={{ color: COBALT }}>QUIZ</p>
        <h1 className="text-2xl font-extrabold text-balance" style={{ color: '#0d0f14' }}>
          Test je kennis
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(13,15,20,0.5)' }}>
          14 vragen over de 6 kernvideo&apos;s. Geen tijdslimiet.
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: 'rgba(13,15,20,0.45)' }}>
            Vraag {current + 1} van {TOTAL}
          </span>
          <span className="text-xs font-semibold" style={{ color: answeredCount === TOTAL ? COBALT : 'rgba(13,15,20,0.35)' }}>
            {answeredCount}/{TOTAL} beantwoord
          </span>
        </div>
        <div className="flex gap-1">
          {QUIZ_QUESTIONS.map((q, i) => (
            <button
              key={q.no}
              onClick={() => setCurrent(i)}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{
                background: i === current
                  ? COBALT
                  : answers[q.no]
                  ? 'rgba(37,0,245,0.3)'
                  : '#e8ecf4',
              }}
            />
          ))}
        </div>
      </div>

      {/* Question card */}
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{ background: '#fff', border: '1px solid #e8ecf4', boxShadow: '0 2px 12px rgba(13,15,20,0.05)' }}
      >
        <p className="text-base font-bold leading-snug" style={{ color: '#0d0f14' }}>
          {current + 1}. {q.vraag}
        </p>

        <div className="space-y-2">
          {(['A', 'B', 'C', 'D'] as QuizOption[]).map((opt) => {
            const isChosen = chosen === opt
            return (
              <button
                key={opt}
                onClick={() => select(opt)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background: isChosen ? 'rgba(37,0,245,0.08)' : '#f8f9fc',
                  border: `1.5px solid ${isChosen ? COBALT : '#e8ecf4'}`,
                  color: isChosen ? COBALT : '#0d0f14',
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: isChosen ? COBALT : '#e8ecf4',
                    color: isChosen ? '#fff' : 'rgba(13,15,20,0.5)',
                  }}
                >
                  {opt}
                </span>
                {q.opties[opt]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prev}
          disabled={current === 0}
          className="text-sm font-semibold px-5 py-2.5 rounded-full transition-opacity disabled:opacity-30"
          style={{ background: '#f0f3fb', color: 'rgba(13,15,20,0.6)', border: '1px solid #e8ecf4' }}
        >
          Vorige
        </button>

        {current < TOTAL - 1 ? (
          <button
            onClick={next}
            disabled={!chosen}
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: COBALT, color: '#fff' }}
          >
            Volgende <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={phase === 'submitting' || answeredCount < TOTAL}
            className="flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-full transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ background: COBALT, color: '#fff' }}
          >
            {phase === 'submitting' ? 'Versturen...' : `Verstuur mijn antwoorden (${answeredCount}/${TOTAL})`}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: '#ef4444' }}>{error}</p>
      )}
    </div>
  )
}
