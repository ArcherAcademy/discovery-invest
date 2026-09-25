'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, MapPin, Users, X } from 'lucide-react'

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
        <main className="relative my-auto max-h-[min(92vh,760px)] w-full max-w-4xl overflow-y-auto rounded-[1.75rem] border border-border/80 bg-background shadow-[0_28px_90px_rgba(13,15,20,0.24)]">
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
              <div className="border-b border-border/70 px-6 pb-6 pt-8 sm:px-9 sm:pb-7 sm:pt-9">
                <div className="flex items-start gap-4 pr-10">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CalendarDays size={21} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invest Masterclass</p>
                    <h1 id="edition-choice-title" className="mt-2 text-balance text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-[30px]">
                      Plan je eerste stap.
                    </h1>
                    <p className="mt-2 max-w-xl text-pretty text-sm leading-6 text-muted-foreground">
                      Kies een periode die voor jou past. We nemen daarna persoonlijk contact met je op.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-6 sm:p-9 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10">
                <section aria-labelledby="edition-list-title">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 id="edition-list-title" className="text-sm font-semibold text-foreground">Beschikbare edities</h2>
                    <span className="text-xs text-muted-foreground">2027</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border/80 bg-card" aria-label="Beschikbare masterclass-edities">
                    {EDITIONS.map((edition, index) => {
                      const isSelected = selectedEdition === edition.id
                      const isAvailable = edition.status === 'Beschikbare plaatsen'
                      return (
                        <button
                          key={edition.id}
                          type="button"
                          onClick={() => setSelectedEdition(edition.id)}
                          aria-pressed={isSelected}
                          className={`group flex w-full items-center gap-4 px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:px-5 ${index > 0 ? 'border-t border-border/70' : ''} ${isSelected ? 'bg-primary/[0.055]' : 'hover:bg-muted/45'}`}
                        >
                          <span className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border ${isSelected ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'}`}>
                            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{edition.month}</span>
                            <span className="mt-0.5 text-xl font-semibold leading-none">{edition.dates.split('–')[0]}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold tracking-tight text-foreground">{edition.title.replace('Editie ', '')}</span>
                            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={12} aria-hidden="true" />{edition.detail}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-right">
                            <span className={`hidden text-xs sm:block ${isAvailable ? 'font-medium text-primary' : 'text-muted-foreground'}`}>{isAvailable ? 'Beschikbaar' : 'Wachtlijst'}</span>
                            <span className={`flex size-5 items-center justify-center rounded-full border ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`} aria-label={isSelected ? 'Geselecteerd' : undefined}>
                              <Check size={12} strokeWidth={3} aria-hidden="true" />
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <aside className="flex flex-col rounded-2xl bg-muted/45 p-5 sm:p-6" aria-live="polite">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Jouw keuze</p>
                  {selected ? (
                    <>
                      <div className="mt-5 flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm"><CalendarDays size={18} aria-hidden="true" /></div>
                        <div>
                          <p className="text-lg font-semibold tracking-tight text-foreground">{selected.dates} {selected.title.replace('Editie ', '')}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{selected.detail}</p>
                        </div>
                      </div>
                      <div className="mt-6 space-y-3 border-t border-border/70 pt-5 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2"><Users size={15} aria-hidden="true" /> Persoonlijke opvolging door ons team</p>
                        <p className="flex items-center gap-2"><Check size={15} aria-hidden="true" /> Geen betaling vooraf</p>
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 flex flex-1 flex-col justify-center">
                      <p className="text-lg font-semibold tracking-tight text-foreground">Nog geen datum gekozen</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Selecteer links een editie om je aanvraag te starten.</p>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!selectedEdition || submitting}
                    onClick={submitCandidate}
                    className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {submitting ? 'Bezig met versturen…' : selected ? 'Deze datum kiezen' : 'Kies eerst een datum'}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  {submitError ? <p role="alert" className="mt-3 text-center text-xs leading-5 text-destructive">{submitError}</p> : null}
                </aside>
              </div>
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
