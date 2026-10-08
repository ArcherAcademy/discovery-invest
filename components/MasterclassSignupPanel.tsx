'use client'

import { track } from '@vercel/analytics'
import { ArrowRight, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Edition = {
  id: string
  date: string
  place: string
  status: 'Plaatsen beschikbaar' | 'Wachtlijst'
}

const editions: Edition[] = [
  { id: 'februari-2027', date: '4–7 februari 2027', place: 'Handelsbeurs Antwerpen', status: 'Plaatsen beschikbaar' },
  { id: 'juni-2027', date: '3–6 juni 2027', place: 'Handelsbeurs Antwerpen', status: 'Wachtlijst' },
  { id: 'oktober-2027', date: '7–10 oktober 2027', place: 'Handelsbeurs Antwerpen', status: 'Wachtlijst' },
]

interface MasterclassSignupPanelProps {
  alreadySubmitted: boolean
  onSubmitted: () => void | Promise<void>
  onViewBonus: () => void
}

export default function MasterclassSignupPanel({ alreadySubmitted, onSubmitted, onViewBonus }: MasterclassSignupPanelProps) {
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(alreadySubmitted)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!alreadySubmitted) return
    setConfirmed(true)
    track('Bevestiging getoond', { source: 'existing_submission' })
  }, [alreadySubmitted])

  const selected = editions.find(edition => edition.id === selectedEdition)

  const selectEdition = (edition: Edition) => {
    setSelectedEdition(edition.id)
    setError(null)
    track('Editie geselecteerd', { edition: edition.id, status: edition.status })
  }

  async function submit() {
    if (!selectedEdition || submitting) return
    setSubmitting(true)
    setError(null)
    track('Submit gestart', { edition: selectedEdition })

    try {
      const response = await fetch('/api/invest-avond/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition: selectedEdition }),
      })
      if (!response.ok) throw new Error('submission_failed')
      setConfirmed(true)
      track('HubSpot verwerkt', { edition: selectedEdition })
      track('Submit voltooid', { edition: selectedEdition })
      track('Bevestiging getoond', { source: 'new_submission' })
      await onSubmitted()
    } catch {
      setError('Je keuze kon niet worden verstuurd. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-7 sm:p-10">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check aria-hidden="true" /></span>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Je voorkeursdatum is ontvangen.</h3>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Iemand van Archer neemt persoonlijk contact met je op. Je keuze is nog geen betaling en verplicht je tot niets.</p>
        <Button type="button" variant="link" onClick={onViewBonus} className="mt-5 px-0">
          Bekijk je bonusmateriaal
          <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={event => { event.preventDefault(); void submit() }} className="rounded-2xl border border-border bg-card p-5 sm:p-8">
      <fieldset aria-label="Beschikbare Masterclass-edities">
        <legend className="sr-only">Kies een Masterclass-editie</legend>
        <div className="flex flex-col gap-3">
          {editions.map(edition => {
            const isSelected = selectedEdition === edition.id
            return (
              <label
                key={edition.id}
                className={cn(
                  'flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors sm:p-5',
                  isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border bg-background hover:border-primary/40',
                )}
              >
                <input
                  type="radio"
                  name="masterclass-edition"
                  value={edition.id}
                  checked={isSelected}
                  onChange={() => selectEdition(edition)}
                  className="size-5 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-foreground">{edition.date}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{edition.place}</span>
                </span>
                <span className={cn('shrink-0 text-right text-xs font-semibold', edition.status === 'Plaatsen beschikbaar' ? 'text-primary' : 'text-muted-foreground')}>{edition.status}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <Button type="submit" disabled={!selectedEdition || submitting} className="mt-6 min-h-12 w-full disabled:bg-secondary disabled:text-secondary-foreground disabled:opacity-100">
        {submitting ? 'Even geduld…' : !selectedEdition ? 'Kies een editie' : selected?.status === 'Wachtlijst' ? 'Op de wachtlijst plaatsen' : 'Mijn voorkeursdatum kiezen'}
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Button>
      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Je betaalt nu niets. Je kiest alleen je voorkeursdatum. Daarna nemen we persoonlijk contact met je op.</p>
      {error ? <p role="alert" className="mt-3 text-center text-sm text-destructive">{error}</p> : null}
    </form>
  )
}
