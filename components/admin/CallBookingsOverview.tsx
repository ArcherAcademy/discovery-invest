'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { CalendarClock, Clock3, RefreshCw, Search, UserRound } from 'lucide-react'
import type { AdminCallBooking } from '@/lib/call-booking-data'

type TimingFilter = 'upcoming' | 'past' | 'unknown'

const fetcher = async (url: string): Promise<{ bookings: AdminCallBooking[]; generated_at: string }> => {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Calls konden niet worden geladen.')
  return data
}

function dayLabel(isoDate: string) {
  const date = new Date(isoDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Vandaag'
  if (date.toDateString() === tomorrow.toDateString()) return 'Morgen'
  const daysAway = Math.ceil((date.getTime() - today.getTime()) / 86_400_000)
  if (daysAway <= 7) return 'Binnenkort'
  return 'Later'
}

function formatDateTime(isoDate: string) {
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

export function CallBookingsOverview() {
  const { data, error, isLoading, isValidating, mutate } = useSWR('/api/admin/call-bookings', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TimingFilter>('upcoming')
  const bookings = data?.bookings ?? []

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return bookings.filter(booking => {
      const matchesTiming = booking.timing === filter
      const haystack = `${booking.name ?? ''} ${booking.email} ${booking.advisor_name ?? ''}`.toLowerCase()
      return matchesTiming && (!normalizedQuery || haystack.includes(normalizedQuery))
    })
  }, [bookings, filter, query])

  const grouped = useMemo(() => {
    const result = new Map<string, AdminCallBooking[]>()
    for (const booking of filtered) {
      const label = booking.start_at ? dayLabel(booking.start_at) : 'Tijdstip onbekend'
      result.set(label, [...(result.get(label) ?? []), booking])
    }
    return result
  }, [filtered])

  const upcomingCount = bookings.filter(booking => booking.timing === 'upcoming').length
  const unknownCount = bookings.filter(booking => booking.timing === 'unknown').length

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
      <header className="flex flex-col gap-5 border-b border-border p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CalendarClock size={19} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-balance">Ingeplande adviescalls</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Zie meteen wie een call heeft geboekt en wanneer het gesprek plaatsvindt.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void mutate()}
            disabled={isValidating}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={15} className={isValidating ? 'animate-spin' : ''} aria-hidden="true" />
            Vernieuwen
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-primary/8 p-4">
            <p className="text-2xl font-bold text-primary">{upcomingCount}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Komende calls</p>
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-2xl font-bold">{unknownCount}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Tijdstip nog onbekend</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex overflow-x-auto rounded-xl border border-border p-1">
            {([
              ['upcoming', `Komend (${upcomingCount})`],
              ['past', 'Voorbij'],
              ['unknown', `Onbekend (${unknownCount})`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${filter === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Zoek op naam, e-mail of adviseur</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Zoek persoon of adviseur…"
              className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>
      </header>

      <div aria-live="polite">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Calls laden…
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p role="alert" className="text-sm text-destructive">{error.message}</p>
            <button type="button" onClick={() => void mutate()} className="text-sm font-semibold text-primary hover:underline">Opnieuw proberen</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Clock3 size={24} className="text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">Geen calls in deze weergave</p>
            <p className="text-sm text-muted-foreground">Pas de filter of zoekterm aan.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {[...grouped.entries()].map(([label, group]) => (
              <div key={label} className="p-5 md:p-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</h3>
                <div className="flex flex-col gap-2">
                  {group.map(booking => (
                    <article key={booking.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <UserRound size={16} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{booking.name || 'Naam onbekend'}</p>
                          <p className="truncate text-xs text-muted-foreground">{booking.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 sm:items-end sm:text-right">
                        <p className="text-sm font-semibold">
                          {booking.start_at ? formatDateTime(booking.start_at) : 'Tijdstip onbekend'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.advisor_name ? `Adviseur: ${booking.advisor_name}` : 'Adviseur niet geregistreerd'}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
