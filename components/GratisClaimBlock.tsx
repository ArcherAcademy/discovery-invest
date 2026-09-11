'use client'

import { FormEvent, useState } from 'react'
import useSWR from 'swr'
import { CalendarDays, CheckCircle2, Loader2, Phone, Ticket } from 'lucide-react'

interface Claim {
  id: string
  mobiel_nummer: string
  datum_keuze: string
  claimed_at: string
  status: string
}

interface GratisClaimBlockProps {
  variant?: 'full' | 'compact' | 'popup'
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Status niet beschikbaar')
  return response.json() as Promise<{ claim: Claim | null }>
}

function formatDatum(datum: string) {
  return new Date(`${datum}T00:00:00`).toLocaleDateString('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function GratisClaimBlock({ variant = 'full' }: GratisClaimBlockProps) {
  const { data, mutate } = useSWR('/api/invest-avond-claim', fetcher, { shouldRetryOnError: false })
  const [mobielNummer, setMobielNummer] = useState('')
  const [datumKeuze, setDatumKeuze] = useState('')
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ingediendeClaim, setIngediendeClaim] = useState<Claim | null>(null)

  const claim = ingediendeClaim ?? data?.claim ?? null
  const compact = variant === 'compact'
  const popup = variant === 'popup'
  const vandaag = new Date().toISOString().slice(0, 10)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/invest-avond-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobiel_nummer: mobielNummer, datum_keuze: datumKeuze, website }),
      })
      const resultaat = await response.json().catch(() => null)
      if (!response.ok) {
        setError(resultaat?.error ?? 'Je aanvraag kon niet worden verstuurd. Probeer opnieuw.')
        return
      }
      setIngediendeClaim(resultaat.claim)
      await mutate({ claim: resultaat.claim }, false)
    } catch {
      setError('Netwerkfout. Controleer je verbinding en probeer opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  if (claim) {
    return (
      <div className={`flex flex-col gap-3 rounded-2xl border border-border bg-card ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="font-bold text-foreground">Je aanvraag is goed ontvangen.</p>
            <p className="text-sm leading-6 text-muted-foreground">Het Archer-team neemt contact met je op.</p>
          </div>
        </div>
        <div className="rounded-xl bg-background px-4 py-3 text-sm text-foreground">
          Voorkeursdatum: <strong>{formatDatum(claim.datum_keuze)}</strong>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-border bg-card ${popup ? 'p-0' : compact ? 'p-4' : 'p-6 md:p-7'}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary">
          <Ticket size={compact ? 15 : 18} />
          <p className="text-xs font-bold uppercase tracking-wider">Vrijgespeeld</p>
        </div>
        <h2 className={`${compact ? 'text-base' : 'text-xl'} font-extrabold text-balance text-foreground`}>
          Proficiat, je hebt een gratis plek verdiend.
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Vul je mobiel nummer en voorkeursdatum in. Het Archer-team bevestigt je plaats persoonlijk.
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold text-foreground">
            Mobiel nummer
            <span className="relative">
              <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                minLength={8}
                maxLength={20}
                value={mobielNummer}
                onChange={event => setMobielNummer(event.target.value)}
                placeholder="bv. +32 470 12 34 56"
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-base text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
              />
            </span>
          </label>

          <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold text-foreground">
            Voorkeursdatum
            <span className="relative">
              <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                required
                min={vandaag}
                value={datumKeuze}
                onChange={event => setDatumKeuze(event.target.value)}
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-base text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
              />
            </span>
          </label>
        </div>

        <label className="absolute -left-[9999px]" aria-hidden="true">
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} />
        </label>

        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className={`flex flex-col gap-3 ${compact ? '' : 'sm:flex-row sm:items-center sm:justify-between'}`}>
          <p className="text-xs leading-5 text-muted-foreground">Eén claim per account. Je gegevens worden enkel gebruikt om je plaats te bevestigen.</p>
          <button type="submit" disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? 'Aanvraag versturen…' : 'Claim mijn gratis avond'}
          </button>
        </div>
      </form>
    </div>
  )
}
