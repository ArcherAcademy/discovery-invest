'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, PhoneCall, Sparkles } from 'lucide-react'
import { useApp } from '@/components/app-context'
import type { DemoEvent, DemoEventBooking } from '@/lib/types'

interface InvestAvondUnlockModalProps {
  open: boolean
  onUnlocked: () => Promise<void> | void
  onClose?: () => void
}

type BookingChoice = 'event' | 'strategy' | null

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function InvestAvondUnlockModal({ open, onUnlocked }: InvestAvondUnlockModalProps) {
  const { videos } = useApp()
  const [events, setEvents] = useState<DemoEvent[]>([])
  const [existingBooking, setExistingBooking] = useState<DemoEventBooking | null>(null)
  const [choice, setChoice] = useState<BookingChoice>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    fetch('/api/discovery-booking', { credentials: 'include' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('events_failed')))
      .then(data => {
        if (cancelled) return
        setEvents(data.events ?? [])
        setExistingBooking(data.booking ?? null)
        if (data.booking) setChoice('event')
      })
      .catch(() => {
        if (!cancelled) setError('We konden de beschikbare momenten niet laden. Probeer opnieuw.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const hasBooked = Boolean(existingBooking || choice === 'strategy')
  const bonusVideos = videos.filter(video => video.section === 'bonus')

  async function bookEvent(eventId: string) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/discovery-booking', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })
      if (!response.ok) throw new Error('event_booking_failed')
      const data = await response.json()
      setExistingBooking(data.booking)
      setChoice('event')
      await onUnlocked()
    } catch {
      setError('Deze plek kon niet worden gereserveerd. Kies een ander moment of probeer opnieuw.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function requestStrategyMeeting() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/strategy-meeting', { method: 'POST', credentials: 'include' })
      if (!response.ok) throw new Error('strategy_request_failed')
      setChoice('strategy')
      await onUnlocked()
    } catch {
      setError('We konden je aanvraag nog niet versturen. Probeer opnieuw.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background text-foreground">
      <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 size={24} />
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">Proficiat</p>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">Je hebt alle zes video&apos;s bekeken.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            <strong className="font-semibold text-foreground">Nu zetten we het om in een plan dat werkt voor jouw cijfers.</strong>
          </p>
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-4xl gap-4 md:grid-cols-2 md:gap-6">
          <section className="flex min-h-[27rem] flex-col rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CalendarDays size={21} /></div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Gratis voor jou</span>
            </div>
            <h2 className="mt-6 text-xl font-bold">Kennismakingsevent</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Halve dag, in groep</li>
              <li>Je eerste stappen worden concreet</li>
              <li>Normaal €97, voor jou gratis zolang je account actief is</li>
            </ul>
            <div className="mt-6 flex-1">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Kies je moment</p>
              {isLoading ? (
                <div className="h-16 animate-pulse rounded-2xl bg-muted" />
              ) : events.length > 0 ? (
                <div className="space-y-2">
                  {events.map(event => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors ${selectedEventId === event.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                    >
                      <span className="block text-sm font-semibold">{formatEventDate(event.starts_at)}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><MapPin size={12} />{event.location} · {event.spots_left} plaatsen</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nieuwe momenten worden binnenkort toegevoegd.</p>}
            </div>
            <button
              type="button"
              disabled={!selectedEventId || isSubmitting || hasBooked}
              onClick={() => selectedEventId && bookEvent(selectedEventId)}
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {existingBooking ? 'Plek gereserveerd' : isSubmitting ? 'Plek reserveren…' : 'Reserveer mijn gratis plek'}
              {!existingBooking && !isSubmitting && <ArrowRight size={17} />}
            </button>
          </section>

          <section className="flex min-h-[27rem] flex-col rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PhoneCall size={21} /></div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Persoonlijk</span>
            </div>
            <h2 className="mt-6 text-xl font-bold">Strategymeeting</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>1-op-1 op kantoor</li>
              <li>Anderhalf uur samen naar je volledige situatie kijken</li>
              <li>We maken ruimte voor jouw cijfers en volgende stap</li>
            </ul>
            <div className="mt-6 flex-1 rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
              Liever persoonlijke begeleiding dan een groepsmoment? Vraag je afspraak aan. We bellen je binnen 24 uur om ze in te plannen.
            </div>
            <button
              type="button"
              disabled={isSubmitting || hasBooked}
              onClick={requestStrategyMeeting}
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-background px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {choice === 'strategy' ? 'Aanvraag ontvangen' : isSubmitting ? 'Aanvraag versturen…' : 'Ik wil naar kantoor komen'}
              {choice !== 'strategy' && !isSubmitting && <ArrowRight size={17} />}
            </button>
          </section>
        </div>

        {error && <p role="alert" className="mx-auto mt-5 text-center text-sm font-medium text-destructive">{error}</p>}

        <p className="mx-auto mt-6 text-center text-sm text-muted-foreground">
          Je plek reserveren of je afspraak aanvragen unlockt meteen je bonusmateriaal.
        </p>
        <p className="mx-auto mt-3 flex items-center gap-2 text-center text-xs text-muted-foreground"><Clock3 size={13} /> Je account staat nog 7 dagen open. Plaatsen zijn beperkt.</p>

        {hasBooked && (
          <section className="mx-auto mt-8 w-full max-w-4xl rounded-3xl border border-primary/20 bg-primary/[0.04] p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 shrink-0 text-primary" size={20} />
              <div>
                <h2 className="font-bold">Je bonusmateriaal is vrijgegeven.</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Je keuze is ontvangen. Dit materiaal staat nu voor je klaar.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {bonusVideos.map(video => (
                <Link key={video.id} href={`/video/${video.id}`} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
                  <span className="block text-sm font-semibold">{video.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{video.content_type === 'pdf' ? 'PDF-gids' : `${Math.ceil((video.duration_seconds ?? 0) / 60)} min video`}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
