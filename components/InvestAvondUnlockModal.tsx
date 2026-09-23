'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Check, CheckCircle2, X } from 'lucide-react'
import { useApp } from '@/components/app-context'
import type { DemoEvent, DemoEventBooking } from '@/lib/types'

interface InvestAvondUnlockModalProps {
  open: boolean
  onUnlocked: () => Promise<void> | void
  onClose?: () => void
}

function formatEditionDate(event: DemoEvent) {
  return new Intl.DateTimeFormat('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(event.starts_at))
}

function editionLabel(event: DemoEvent) {
  return event.title.replace(/^(Live\s+)?Invest-avond\s*[—-]\s*/i, '')
}

export default function InvestAvondUnlockModal({ open, onUnlocked, onClose }: InvestAvondUnlockModalProps) {
  const { videos } = useApp()
  const [editions, setEditions] = useState<DemoEvent[]>([])
  const [existingBooking, setExistingBooking] = useState<DemoEventBooking | null>(null)
  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch('/api/discovery-booking', { credentials: 'include' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('editions_failed')))
      .then(data => {
        if (cancelled) return
        const booking = data.booking ?? null
        setEditions(data.events ?? [])
        setExistingBooking(booking)
        setSelectedEditionId(booking?.event_id ?? null)
        setConfirmed(Boolean(booking))
      })
      .catch(() => {
        if (!cancelled) setError('De edities konden niet geladen worden. Probeer opnieuw.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const bonusVideos = videos.filter(video => video.section === 'bonus')

  async function nominate() {
    if (!selectedEditionId || isSubmitting || confirmed) return
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/discovery-booking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEditionId }),
      })
      if (!response.ok) throw new Error('nomination_failed')
      const data = await response.json()
      setExistingBooking(data.booking ?? null)
      setConfirmed(true)
      await onUnlocked()
    } catch {
      setError('Je keuze kon nog niet opgeslagen worden. Probeer opnieuw.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-foreground/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="edition-choice-title">
      <div className="flex min-h-full items-center justify-center">
        <main className="relative my-auto w-full max-w-2xl rounded-3xl border border-border bg-background p-5 shadow-2xl sm:p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Later sluiten"
            className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X size={19} />
          </button>

          {!confirmed ? (
            <>
              <div className="pr-10">
                <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CheckCircle2 size={23} />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Alle video&apos;s bekeken</p>
                <h1 id="edition-choice-title" className="mt-2 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                  Kies de editie waarvoor je kandidaat wilt zijn.
                </h1>
                <p className="mt-3 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                  <strong className="font-semibold text-foreground">Je kandidaatstelling verplicht je tot niets.</strong> We bellen je op om samen te bekijken of de editie bij je past.
                </p>
              </div>

              <div className="mt-7 space-y-3" aria-label="Beschikbare masterclass-edities">
                {isLoading ? (
                  [1, 2, 3].map(item => <div key={item} className="h-20 animate-pulse rounded-2xl bg-muted" />)
                ) : editions.length > 0 ? (
                  editions.map(edition => {
                    const selected = selectedEditionId === edition.id
                    return (
                      <button
                        key={edition.id}
                        type="button"
                        onClick={() => setSelectedEditionId(edition.id)}
                        className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected ? 'border-primary bg-primary/[0.06]' : 'border-border bg-card hover:border-primary/40'}`}
                        aria-pressed={selected}
                      >
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {selected ? <Check size={18} /> : <CalendarDays size={18} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{editionLabel(edition)}</span>
                          <span className="mt-1 block text-sm text-muted-foreground">{formatEditionDate(edition)} · {edition.location}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">{edition.spots_left} plaatsen</span>
                      </button>
                    )
                  })
                ) : (
                  <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Er zijn momenteel geen edities beschikbaar.</p>
                )}
              </div>

              {error && <p role="alert" className="mt-4 text-sm font-medium text-destructive">{error}</p>}

              <button
                type="button"
                disabled={!selectedEditionId || isSubmitting || isLoading}
                onClick={nominate}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {isSubmitting ? 'Keuze opslaan…' : 'Stel mij kandidaat'}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">Je hoeft hier geen gegevens opnieuw in te vullen.</p>
            </>
          ) : (
            <div className="py-5 text-center sm:py-8">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 size={29} />
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">Kandidaatstelling ontvangen</p>
              <h1 id="edition-choice-title" className="mt-2 text-balance text-2xl font-bold tracking-tight sm:text-3xl">Top. Je keuze is ontvangen.</h1>
              <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-muted-foreground sm:text-base">We bellen je binnen 24 uur op om je plek te bespreken en in te plannen.</p>
              <div className="mx-auto mt-6 max-w-md rounded-2xl bg-primary/[0.06] p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Jouw keuze</p>
                <p className="mt-1 font-semibold">{editions.find(edition => edition.id === (existingBooking?.event_id ?? selectedEditionId)) ? editionLabel(editions.find(edition => edition.id === (existingBooking?.event_id ?? selectedEditionId))!) : 'Masterclass-editie'}</p>
              </div>
              <button type="button" onClick={onClose} className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                Sluiten
              </button>
              <div className="mt-7 border-t border-border pt-6 text-left">
                <p className="text-sm font-semibold">Je bonusmateriaal staat nu klaar.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {bonusVideos.map(video => (
                    <a key={video.id} href={`/video/${video.id}`} className="rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:border-primary/40">{video.title}</a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
