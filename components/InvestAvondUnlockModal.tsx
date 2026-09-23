'use client'

import { useState } from 'react'
import { Check, CheckCircle2, X } from 'lucide-react'

type Edition = {
  id: string
  month: string
  dates: string
  year: string
  title: string
  detail: string
  filled: number
  badge: string
  available: boolean
}

const EDITIONS: Edition[] = [
  {
    id: 'februari-2027',
    month: 'FEB',
    dates: '4–7',
    year: "'27",
    title: 'Editie februari 2027',
    detail: 'donderdag 4 tot zondag 7 februari 2027 · Antwerpen · beperkt aantal plaatsen',
    filled: 55,
    badge: 'Wachtlijst open',
    available: true,
  },
  {
    id: 'juni-2027',
    month: 'JUN',
    dates: '3–6',
    year: "'27",
    title: 'Editie juni 2027',
    detail: 'donderdag 3 tot zondag 6 juni 2027 · Antwerpen · beperkt aantal plaatsen',
    filled: 14,
    badge: 'Binnenkort',
    available: false,
  },
  {
    id: 'oktober-2027',
    month: 'OKT',
    dates: '7–10',
    year: "'27",
    title: 'Editie oktober 2027',
    detail: 'donderdag 7 tot zondag 10 oktober 2027 · Antwerpen · beperkt aantal plaatsen',
    filled: 10,
    badge: 'Binnenkort',
    available: false,
  },
]

interface InvestAvondUnlockModalProps {
  open: boolean
  onClose?: () => void
}

export default function InvestAvondUnlockModal({ open, onClose }: InvestAvondUnlockModalProps) {
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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Alle video&apos;s bekeken</p>
                <h1 id="edition-choice-title" className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.65rem]">
                  Kies de editie waarvoor je kandidaat wilt zijn.
                </h1>
                <p className="mt-4 text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                  <strong className="font-semibold text-foreground">Je kandidaatstelling verplicht je tot niets.</strong> We bellen je op om samen te bekijken of de editie bij je past.
                </p>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-3" aria-label="Beschikbare masterclass-edities">
                {EDITIONS.map(edition => {
                  const isSelected = selectedEdition === edition.id
                  return (
                    <button
                      key={edition.id}
                      type="button"
                      onClick={() => setSelectedEdition(edition.id)}
                      aria-pressed={isSelected}
                      className={`flex min-h-56 flex-col rounded-2xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5 ${isSelected ? 'border-primary bg-primary/[0.07] shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]' : 'border-border bg-card hover:border-primary/45 hover:bg-primary/[0.025]'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border text-center ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/20 bg-primary/[0.06] text-primary'}`}>
                          <span className="text-[10px] font-bold tracking-[0.16em]">{edition.month}</span>
                          <span className="text-xl font-bold leading-5">{edition.dates}</span>
                          <span className="text-[10px]">{edition.year}</span>
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${edition.available ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {edition.badge}
                        </span>
                      </div>
                      <span className="mt-5 block font-semibold text-foreground">{edition.title}</span>
                      <span className="mt-2 block text-sm leading-5 text-muted-foreground">{edition.detail}</span>
                      <span className="mt-auto pt-5">
                        <span className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                          <span>VULGRAAD</span>
                          <span>{edition.filled}% gevuld</span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-primary/10">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${edition.filled}%` }} />
                        </span>
                      </span>
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
              <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">Je hoeft hier geen gegevens opnieuw in te vullen.</p>
            </>
          ) : (
            <div className="mx-auto max-w-xl py-8 text-center sm:py-12">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check size={28} />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">Kandidaatstelling ontvangen</p>
              <h1 id="edition-choice-title" className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">Top. We bellen je binnen 24u op om je plek te bespreken.</h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Je koos voor {selected?.title}. We nemen persoonlijk contact met je op.</p>
              <button type="button" onClick={close} className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Sluiten
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
