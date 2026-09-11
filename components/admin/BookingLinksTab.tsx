'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { CalendarDays, CheckCircle2, Plus, RefreshCw, Trash2 } from 'lucide-react'

interface BookingLink {
  id: string
  owner_email: string
  naam: string
  booking_url: string
  actief: boolean
  is_default: boolean
}

const fetcher = async (url: string): Promise<{ links: BookingLink[] }> => {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Laden mislukt')
  return data
}

const emptyForm = { owner_email: '', naam: '', booking_url: '', actief: true, is_default: false }

export function BookingLinksTab() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/booking-links', fetcher)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    const response = await fetch('/api/admin/booking-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const result = await response.json().catch(() => null)
    setSaving(false)
    if (!response.ok) {
      setFeedback(result?.error ?? 'Opslaan mislukt.')
      return
    }
    setForm(emptyForm)
    setFeedback('Boekingslink opgeslagen.')
    await mutate()
  }

  async function remove(id: string) {
    if (!window.confirm('Deze boekingslink verwijderen?')) return
    const response = await fetch(`/api/admin/booking-links?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) await mutate()
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Persoonlijke boekingslinks</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Koppel het e-mailadres van de HubSpot-contacteigenaar aan diens persoonlijke agenda. De standaardlink vangt contacten zonder match op.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="mt-5 grid gap-3 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold">
            Naam adviseur
            <input required value={form.naam} onChange={event => setForm(current => ({ ...current, naam: event.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/20" placeholder="Voornaam Achternaam" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold">
            HubSpot-e-mailadres
            <input required type="email" value={form.owner_email} onChange={event => setForm(current => ({ ...current, owner_email: event.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/20" placeholder="adviseur@bedrijf.be" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold lg:col-span-2">
            Boekingslink
            <input required type="url" value={form.booking_url} onChange={event => setForm(current => ({ ...current, booking_url: event.target.value }))} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary/20" placeholder="https://meetings.hubspot.com/..." />
          </label>
          <div className="flex flex-wrap items-center gap-4 lg:col-span-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.actief} onChange={event => setForm(current => ({ ...current, actief: event.target.checked }))} /> Actief</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_default} onChange={event => setForm(current => ({ ...current, is_default: event.target.checked }))} /> Gebruik als standaardlink</label>
            <button disabled={saving} className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
              Opslaan
            </button>
          </div>
          {feedback && <p role="status" className="text-sm text-muted-foreground lg:col-span-2">{feedback}</p>}
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground">
        {isLoading ? (
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><RefreshCw size={15} className="animate-spin" /> Laden…</div>
        ) : error ? (
          <p role="alert" className="p-5 text-sm text-destructive">{error.message}</p>
        ) : (data?.links.length ?? 0) === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nog geen boekingslinks ingesteld.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3">Adviseur</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Link</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actie</th></tr></thead>
              <tbody>
                {data?.links.map(link => (
                  <tr key={link.id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{link.naam}</td>
                    <td className="px-4 py-3 text-muted-foreground">{link.owner_email}</td>
                    <td className="max-w-64 truncate px-4 py-3"><a href={link.booking_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{link.booking_url}</a></td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{link.actief && <CheckCircle2 size={12} />}{link.is_default ? 'Standaard' : link.actief ? 'Actief' : 'Inactief'}</span></td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => remove(link.id)} aria-label={`Verwijder boekingslink van ${link.naam}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
