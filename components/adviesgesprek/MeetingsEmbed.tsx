'use client'

import Script from 'next/script'
import useSWR from 'swr'
import { useEffect, useRef } from 'react'
import { CalendarDays, ExternalLink, Loader2 } from 'lucide-react'

interface BookingResponse {
  booking: {
    naam: string
    booking_url: string
    embed_url: string
    routing: 'owner' | 'round_robin'
  }
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? 'De agenda kon niet worden geladen.')
  return data as BookingResponse
}

async function registreer(action: 'open' | 'click') {
  await fetch('/api/adviesgesprek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }).catch(() => null)
}

export function MeetingsEmbed() {
  const { data, error, isLoading } = useSWR('/api/adviesgesprek', fetcher, { shouldRetryOnError: false })
  const openGeregistreerd = useRef(false)

  useEffect(() => {
    if (!data || openGeregistreerd.current) return
    openGeregistreerd.current = true
    void registreer('open')
  }, [data])

  if (isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-2xl border border-border bg-card">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        <span className="ml-3 text-sm text-muted-foreground">Agenda laden…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="font-semibold text-foreground">Agenda tijdelijk niet beschikbaar</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {error instanceof Error ? error.message : 'Probeer het later opnieuw.'}
        </p>
      </div>
    )
  }

  return (
    <section aria-label="Beschikbare momenten" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
            <CalendarDays size={17} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Kies een moment dat voor jou past</p>
            <p className="text-xs text-muted-foreground">Je afspraak wordt meteen bevestigd.</p>
          </div>
        </div>
        <a
          href={data.booking.booking_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void registreer('click')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          Open in een nieuw venster
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>

      <Script src="https://static.hsappstatic.net/MeetingsEmbed/ex/MeetingsEmbedCode.js" strategy="afterInteractive" />
      <div className="meetings-iframe-container min-h-[720px]" data-src={data.booking.embed_url} />
    </section>
  )
}
