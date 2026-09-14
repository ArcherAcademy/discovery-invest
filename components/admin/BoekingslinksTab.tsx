'use client'

import useSWR from 'swr'
import { useState } from 'react'
import { CalendarDays, CheckCircle2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Boekingslink } from '@/lib/adviesgesprek'

const leegFormulier = {
  id: '',
  hubspot_owner_id: '',
  naam: '',
  booking_url: '',
  actief: true,
  is_default: false,
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Boekingslinks konden niet worden geladen.')
  return response.json() as Promise<{ links: Boekingslink[] }>
}

export function BoekingslinksTab() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/boekingslinks', fetcher)
  const [formulier, setFormulier] = useState(leegFormulier)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  function bewerk(link: Boekingslink) {
    setFormulier({
      id: link.id,
      hubspot_owner_id: link.hubspot_owner_id ?? '',
      naam: link.naam,
      booking_url: link.booking_url,
      actief: link.actief,
      is_default: link.is_default,
    })
    setFeedback(null)
    setOpen(true)
  }

  function nieuw() {
    setFormulier(leegFormulier)
    setFeedback(null)
    setOpen(true)
  }

  async function opslaan(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    const response = await fetch('/api/admin/boekingslinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formulier),
    })
    const result = await response.json().catch(() => null)
    setSaving(false)
    if (!response.ok) {
      setFeedback(result?.error ?? 'Opslaan mislukt.')
      return
    }
    setOpen(false)
    await mutate()
  }

  async function verwijderen(link: Boekingslink) {
    if (!window.confirm(`Verwijder de agenda van ${link.naam}?`)) return
    const response = await fetch('/api/admin/boekingslinks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: link.id }),
    })
    if (response.ok) await mutate()
  }

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="size-5 animate-spin text-primary" /></div>
  if (error) return <p role="alert" className="rounded-xl border border-border bg-card p-5 text-sm text-foreground">{error.message}</p>

  const links = data?.links ?? []
  const heeftDefault = links.some(link => link.actief && link.is_default)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><CalendarDays size={18} /></span>
          <div>
            <h2 className="font-bold text-foreground">Agenda-routing</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Een bekende owner krijgt uitsluitend zijn eigen agenda. Alle andere leads gaan naar de actieve standaardagenda voor round-robinverdeling.
            </p>
          </div>
        </div>
        <button type="button" onClick={nieuw} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <Plus size={15} />Agenda toevoegen
        </button>
      </div>

      {!heeftDefault && (
        <p role="status" className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-foreground">
          Stel één actieve standaardagenda in. Zonder deze link kunnen leads met een onbekende owner niet boeken.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr><th className="px-4 py-3 font-semibold">Naam</th><th className="px-4 py-3 font-semibold">Owner-ID</th><th className="px-4 py-3 font-semibold">Route</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Acties</th></tr>
          </thead>
          <tbody>
            {links.map(link => (
              <tr key={link.id} className="border-t border-border">
                <td className="px-4 py-3"><p className="font-semibold text-foreground">{link.naam}</p><p className="max-w-72 truncate text-xs text-muted-foreground">{link.booking_url}</p></td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">{link.hubspot_owner_id ?? '—'}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">{link.is_default ? 'Round-robin' : 'Eigen agenda'}</span></td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">{link.actief && <CheckCircle2 size={13} className="text-primary" />}{link.actief ? 'Actief' : 'Inactief'}</span></td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" onClick={() => bewerk(link)} aria-label={`${link.naam} bewerken`} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Pencil size={15} /></button><button type="button" onClick={() => verwijderen(link)} aria-label={`${link.naam} verwijderen`} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Trash2 size={15} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onMouseDown={() => setOpen(false)}>
          <form onSubmit={opslaan} onMouseDown={event => event.stopPropagation()} className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-foreground">{formulier.id ? 'Agenda bewerken' : 'Agenda toevoegen'}</h3><button type="button" onClick={() => setOpen(false)} aria-label="Sluiten" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X size={17} /></button></div>
            <div className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">Naam<input required value={formulier.naam} onChange={e => setFormulier(f => ({ ...f, naam: e.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">HubSpot owner-ID<input required={!formulier.is_default} disabled={formulier.is_default} value={formulier.hubspot_owner_id} onChange={e => setFormulier(f => ({ ...f, hubspot_owner_id: e.target.value }))} placeholder={formulier.is_default ? 'Niet nodig voor round-robin' : 'Bijvoorbeeld 36112549'} className="rounded-xl border border-border bg-background px-3 py-2.5 font-mono font-normal outline-none disabled:opacity-50 focus:ring-2 focus:ring-primary/20" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">HubSpot booking-URL<input required type="url" value={formulier.booking_url} onChange={e => setFormulier(f => ({ ...f, booking_url: e.target.value }))} placeholder="https://meetings-eu1.hubspot.com/..." className="rounded-xl border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary/20" /></label>
              <div className="flex flex-col gap-3 rounded-xl bg-secondary p-4 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground"><input type="checkbox" checked={formulier.actief} onChange={e => setFormulier(f => ({ ...f, actief: e.target.checked }))} className="size-4 accent-primary" />Actief</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground"><input type="checkbox" checked={formulier.is_default} onChange={e => setFormulier(f => ({ ...f, is_default: e.target.checked, hubspot_owner_id: e.target.checked ? '' : f.hubspot_owner_id }))} className="size-4 accent-primary" />Standaard round-robin</label>
              </div>
            </div>
            {feedback && <p role="alert" className="mt-4 text-sm font-semibold text-foreground">{feedback}</p>}
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground">Annuleren</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />}Opslaan</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
