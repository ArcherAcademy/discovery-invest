'use client'

import { useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'

type Edition = {
  id: string
  month: string
  dates: string
  year: string
  title: string
  detail: string
  status: 'Beschikbare plaatsen' | 'Op de wachtlijst'
}

const EDITIONS: Edition[] = [
  {
    id: 'februari-2027',
    month: 'FEB',
    dates: '4–7',
    year: "'27",
    title: 'Editie februari 2027',
    detail: 'Antwerpen · Handelsbeurs',
    status: 'Beschikbare plaatsen',
  },
  {
    id: 'juni-2027',
    month: 'JUN',
    dates: '3–6',
    year: "'27",
    title: 'Editie juni 2027',
    detail: 'Antwerpen · Handelsbeurs',
    status: 'Op de wachtlijst',
  },
  {
    id: 'oktober-2027',
    month: 'OKT',
    dates: '7–10',
    year: "'27",
    title: 'Editie oktober 2027',
    detail: 'Antwerpen · Handelsbeurs',
    status: 'Op de wachtlijst',
  },
]

interface InvestAvondUnlockModalProps {
  open: boolean
  onClose?: () => void
  onViewBonus: () => void
}

export default function InvestAvondUnlockModal({ open, onClose, onViewBonus }: InvestAvondUnlockModalProps) {
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!open) return null

  const selected = EDITIONS.find(edition => edition.id === selectedEdition)

  function close() {
    setSelectedEdition(null)
    setConfirmed(false)
    setSubmitting(false)
    setSubmitError(null)
    onClose?.()
  }

  async function submitCandidate() {
    if (!selectedEdition || submitting) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch('/api/invest-avond/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition: selectedEdition }),
      })
      if (!response.ok) throw new Error('submission_failed')
      setConfirmed(true)
    } catch {
      setSubmitError('Je keuze kon niet worden verstuurd. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-foreground/65 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edition-choice-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <main className="relative my-auto max-h-[min(92vh,800px)] w-full max-w-4xl overflow-y-auto rounded-xl border border-border/80 bg-background p-6 shadow-[0_24px_80px_rgba(13,15,20,0.22)] sm:p-9 lg:p-12">
          <button
            type="button"
            onClick={close}
            aria-label="Popup sluiten"
            className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-6 sm:top-6"
          >
            <X size={20} />
          </button>

          {!confirmed ? (
            <>
              <div className="max-w-2xl pr-10 sm:pr-12">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Invest Masterclass</p>
                <h1 id="edition-choice-title" className="mt-4 max-w-xl text-pretty text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
                  Wanneer wil je jouw vermogensplan bouwen?
                </h1>
                <p className="mt-5 max-w-xl text-pretty text-[15px] leading-7 text-muted-foreground">
                  Kies je voorkeurseditie. We nemen daarna persoonlijk contact met je op om je plaats en situatie te bespreken.
                </p>
                <p className="mt-3 text-sm text-foreground">Geen betaling vooraf. Geen verplichting.</p>
              </div>

              <div className="mt-9 grid gap-3 lg:grid-cols-3" aria-label="Beschikbare masterclass-edities">
                {EDITIONS.map(edition => {
                  const isSelected = selectedEdition === edition.id
                  return (
                    <button
                      key={edition.id}
                      type="button"
                      onClick={() => setSelectedEdition(edition.id)}
                      aria-pressed={isSelected}
                      className={`relative flex min-h-40 flex-col rounded-lg border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${isSelected ? 'border-foreground bg-card' : 'border-border bg-card hover:border-foreground/40'}`}
                    >
                      {isSelected ? (
                        <span className="absolute right-5 top-5 text-primary" aria-label="Geselecteerd">
                          <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      ) : null}
                      <div className="flex items-start gap-3 pr-8">
                        <span className="flex flex-col border-r border-border pr-3 text-primary">
                          <span className="text-[10px] font-semibold tracking-[0.18em]">{edition.month}</span>
                          <span className="mt-1 text-2xl font-semibold leading-none tracking-tight">{edition.dates}</span>
                          <span className="mt-1 text-[10px] text-muted-foreground">{edition.year}</span>
                        </span>
                        <span className="flex min-h-[4.75rem] flex-col justify-center">
                          <span className="font-medium text-foreground">{edition.title.replace('Editie ', '')}</span>
                          <span className="mt-1 text-sm leading-5 text-muted-foreground">{edition.detail}</span>
                        </span>
                      </div>
                      <span className="mt-auto pt-5 text-xs font-medium text-muted-foreground">
                        {edition.status}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={!selectedEdition || submitting}
                onClick={submitCandidate}
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {selected ? `Verder met ${selected.title.replace('Editie ', '')}` : 'Kies je voorkeurseditie'}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              {submitError ? <p role="alert" className="mt-3 text-center text-xs leading-5 text-destructive">{submitError}</p> : null}
            </>
          ) : (
            <div className="mx-auto max-w-xl py-8 text-center sm:py-12">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check size={28} />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">Voorkeursdatum ontvangen</p>
              <h1 id="edition-choice-title" className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">Proficiat met je keuze.</h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Je koos voor {selected?.title}. <strong className="font-semibold text-foreground">Iemand van ons team neemt zo snel mogelijk contact met je op.</strong> Je betaalt nu niets en je keuze verplicht je tot niets.
              </p>
              <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-primary/15 bg-primary/[0.06] p-5 text-left sm:p-6">
                <p className="text-sm leading-6 text-foreground sm:text-base">In de tussentijd: geniet alvast van je bonusmateriaal, verdiend door de hele videoreeks uit te kijken.</p>
                <button type="button" onClick={onViewBonus} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  Bekijk je bonus
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
              <button type="button" onClick={close} className="mt-5 inline-flex min-h-9 items-center justify-center px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Sluiten
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
