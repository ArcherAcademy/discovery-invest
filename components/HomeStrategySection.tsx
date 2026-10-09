'use client'

import { track } from '@vercel/analytics'
import { Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import CallBookingBlock from '@/components/CallBookingBlock'
import { useApp } from '@/components/app-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const editions = [
  {
    id: 'februari-2027',
    date: '4–7 feb',
    details: 'Handelsbeurs Antwerpen · Februari 2027 · Eerstvolgende',
  },
  {
    id: 'juni-2027',
    date: '3–6 jun',
    details: 'Handelsbeurs Antwerpen · Juni 2027',
  },
  {
    id: 'oktober-2027',
    date: '7–10 okt',
    details: 'Handelsbeurs Antwerpen · Oktober 2027',
  },
]

export function HomeStrategySection() {
  const { investAvondGeclaimd, refresh } = useApp()
  const [selectedEdition, setSelectedEdition] = useState('februari-2027')
  const [submitted, setSubmitted] = useState(investAvondGeclaimd)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitEdition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    track('Homepage editieformulier gestart', { edition: selectedEdition })

    try {
      const response = await fetch('/api/invest-avond/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition: selectedEdition, source: 'homepage' }),
      })

      if (!response.ok) throw new Error('submission_failed')

      setSubmitted(true)
      await refresh()
      track('Homepage editieformulier voltooid', { edition: selectedEdition })
    } catch {
      setError('Je keuze kon niet worden verstuurd. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="strategy-section-title" className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-stretch">
      <h2 id="strategy-section-title" className="sr-only">Kies je volgende stap</h2>

      <CallBookingBlock unlocked variant="homepage" />

      <form
        onSubmit={submitEdition}
        className="flex min-h-[490px] min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Gratis · Strategy-call</p>
          <h3 className="mt-4 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground">Zet mij op de wachtlijst.</h3>
          <p className="mt-3 text-base leading-7 text-muted-foreground">We nemen binnen 1 werkdag persoonlijk contact met je op.</p>
        </div>

        {submitted ? (
          <div className="my-auto flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-lg font-bold text-foreground">Je keuze is goed ontvangen.</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">We nemen persoonlijk contact met je op.</p>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="mt-7">
              <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-foreground">Kies je editie</legend>
              <div className="flex flex-col gap-2.5">
                {editions.map(edition => {
                  const selected = selectedEdition === edition.id
                  return (
                    <label
                      key={edition.id}
                      className={cn(
                        'flex min-h-[72px] cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-colors',
                        selected ? 'border-primary bg-primary/[0.06] ring-1 ring-primary' : 'border-border bg-background hover:border-primary/40',
                      )}
                    >
                      <input
                        type="radio"
                        name="homepage-masterclass-edition"
                        value={edition.id}
                        checked={selected}
                        onChange={() => {
                          setSelectedEdition(edition.id)
                          setError(null)
                          track('Homepage editie geselecteerd', { edition: edition.id })
                        }}
                        className="size-5 shrink-0 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-base font-bold text-foreground">{edition.date}</span>
                        <span className="block truncate text-xs leading-5 text-muted-foreground">{edition.details}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="mt-auto pt-7">
              <Button type="submit" disabled={submitting} className="min-h-14 w-full rounded-xl text-base font-bold">
                {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                {submitting ? 'Even geduld…' : 'Hou mijn plek vast'}
              </Button>
              {error ? <p role="alert" className="mt-3 text-center text-sm text-destructive">{error}</p> : null}
            </div>
          </>
        )}
      </form>
    </section>
  )
}
