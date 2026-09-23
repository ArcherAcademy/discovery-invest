'use client'

import { useState } from 'react'
import { ArrowRight, Check, CheckCircle2, X } from 'lucide-react'

type Edition = {
  id: string
  month: string
  dates: string
  year: string
  title: string
  detail: string
  status: 'Beschikbare plaatsen' | 'Interesse doorgeven'
  available: boolean
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
    available: true,
  },
  {
    id: 'juni-2027',
    month: 'JUN',
    dates: '3–6',
    year: "'27",
    title: 'Editie juni 2027',
    detail: 'Antwerpen · Handelsbeurs',
    status: 'Interesse doorgeven',
    available: true,
  },
  {
    id: 'oktober-2027',
    month: 'OKT',
    dates: '7–10',
    year: "'27",
    title: 'Editie oktober 2027',
    detail: 'Antwerpen · Handelsbeurs',
    status: 'Interesse doorgeven',
    available: true,
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

  if (!open) return null

  const selected = EDITIONS.find(edition => edition.id === selectedEdition)

  function close() {
    setSelectedEdition(null)
    setConfirmed(false)
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-foreground/65 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edition-choice-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <main className="relative my-auto max-h-[min(92vh,800px)] w-full max-w-5xl overflow-y-auto rounded-[1.75rem] border border-border bg-background p-5 shadow-2xl sm:p-8 lg:p-10">
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
                <div className="mb-6 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 size={23} />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Kies je voorkeursdatum</p>
                <h1 id="edition-choice-title" className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.65rem]">
                  Kies de editie die bij jou past.
                </h1>
                <p className="mt-4 max-w-3xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                  <strong className="font-semibold text-foreground">Je kandidaatstelling verplicht je tot niets.</strong> Daarna neemt iemand van ons team contact met je op om je situatie te bespreken en te bekijken of de Invest Masterclass bij je past.
                </p>
              </div>

              <section className="mt-6 rounded-2xl border border-border/70 bg-card/60 px-4 py-4 sm:px-5" aria-labelledby="masterclass-takeaways-title">
                <h2 id="masterclass-takeaways-title" className="text-sm font-semibold text-foreground">Wat je meeneemt uit de Masterclass</h2>
                <ul className="mt-3 grid gap-x-6 gap-y-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                  {[
                    'Je persoonlijke levensprojectie met jouw cijfers',
                    'Je GGR berekend, voor en na',
                    'Je verdeling over de 12 domeinen, vastgelegd',
                    'Je plan voor de komende 12 maanden op papier',
                    'De vermogensplanner, voor altijd',
                    '3 maanden 1-op-1 begeleiding met een vermogensexpert',
                    'Een netwerk van 100 ondernemers',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="mt-6 grid gap-3 lg:grid-cols-3" aria-label="Beschikbare masterclass-edities">
                {EDITIONS.map(edition => {
                  const isSelected = selectedEdition === edition.id
                  return (
                    <button
                      key={edition.id}
                      type="button"
                      onClick={() => setSelectedEdition(edition.id)}
                      aria-pressed={isSelected}
                      className={`flex min-h-44 flex-col rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5 ${isSelected ? 'border-primary bg-primary/[0.07] shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]' : 'border-border bg-card hover:border-primary/45 hover:bg-primary/[0.025]'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/20 bg-primary/[0.06] text-primary'}`}>
                          <span className="text-[10px] font-bold tracking-[0.16em]">{edition.month}</span>
                          <span className="text-xl font-bold leading-5">{edition.dates}</span>
                          <span className="text-[10px]">{edition.year}</span>
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${edition.available ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {edition.status}
                        </span>
                      </div>
                      <span className="mt-5 block font-semibold text-foreground">{edition.title}</span>
                      <span className="mt-2 block text-sm leading-5 text-muted-foreground">{edition.detail}</span>

                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={!selectedEdition}
                onClick={() => setConfirmed(true)}
                className="mt-7 inline-flex min-h-13 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Stel mij kandidaat
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">Geen betaling. Geen verplichting.</p>
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
