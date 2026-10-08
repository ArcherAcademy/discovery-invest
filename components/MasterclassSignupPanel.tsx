'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'

type Edition = {
  id: string
  date: string
  year: string
  place: string
  status: 'Plaatsen beschikbaar' | 'Wachtlijst'
}

const editions: Edition[] = [
  { id: 'februari-2027', date: '4–7 februari', year: '2027', place: 'Handelsbeurs Antwerpen', status: 'Plaatsen beschikbaar' },
  { id: 'juni-2027', date: '3–6 juni', year: '2027', place: 'Handelsbeurs Antwerpen', status: 'Wachtlijst' },
  { id: 'oktober-2027', date: '7–10 oktober', year: '2027', place: 'Handelsbeurs Antwerpen', status: 'Wachtlijst' },
]

interface MasterclassSignupPanelProps {
  alreadySubmitted: boolean
  onSubmitted: () => void | Promise<void>
  onViewBonus: () => void
  compact?: boolean
  instanceId: string
}

export default function MasterclassSignupPanel({ alreadySubmitted, onSubmitted, onViewBonus, compact = false, instanceId }: MasterclassSignupPanelProps) {
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(alreadySubmitted)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (alreadySubmitted) setConfirmed(true)
  }, [alreadySubmitted])

  const selected = editions.find(edition => edition.id === selectedEdition)

  async function submit() {
    if (!selectedEdition || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/invest-avond/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition: selectedEdition }),
      })
      if (!response.ok) throw new Error('submission_failed')
      setConfirmed(true)
      await onSubmitted()
    } catch {
      setError('Je keuze kon niet worden verstuurd. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmed) {
    return (
      <div className="border-l-2 border-primary pl-6 sm:pl-8">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-5" aria-hidden="true" /></span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Je voorkeursdatum is ontvangen.</h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Iemand van Archer neemt persoonlijk contact met je op. Je keuze is nog geen betaling en verplicht je tot niets.</p>
        <button type="button" onClick={onViewBonus} className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-primary pb-1 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          Bekijk je bonusmateriaal <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kies jouw moment</p>
      <h2 className={`${compact ? 'mt-2 text-2xl' : 'mt-3 text-3xl sm:text-4xl'} text-balance font-semibold tracking-[-0.04em] text-foreground`}>Welke editie past in jouw agenda?</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Kies vrijblijvend een voorkeursdatum. Daarna bespreken we persoonlijk of de Masterclass bij je past.</p>

      <fieldset className="mt-6 border-y border-border" aria-label="Beschikbare edities">
        {editions.map(edition => {
          const selectedRow = selectedEdition === edition.id
          return (
            <label key={edition.id} className="flex cursor-pointer items-center gap-4 border-b border-border py-4 last:border-b-0">
              <input type="radio" name={`masterclass-edition-${instanceId}`} value={edition.id} checked={selectedRow} onChange={() => setSelectedEdition(edition.id)} className="size-4 shrink-0 accent-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{edition.date} {edition.year}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{edition.place}</span>
              </span>
              <span className={`shrink-0 text-xs font-medium ${edition.status === 'Plaatsen beschikbaar' ? 'text-primary' : 'text-muted-foreground'}`}>{edition.status}</span>
            </label>
          )
        })}
      </fieldset>

      <button type="button" disabled={!selectedEdition || submitting} onClick={submit} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {submitting ? 'Even geduld…' : selected?.status === 'Wachtlijst' ? 'Zet mij op de wachtlijst' : 'Kies deze voorkeursdatum'}
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">Geen betaling. Geen definitieve inschrijving.</p>
      {error ? <p role="alert" className="mt-3 text-center text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
