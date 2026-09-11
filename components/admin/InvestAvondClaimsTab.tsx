'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Check, Download, RefreshCw, Search } from 'lucide-react'

interface Claim {
  id: string
  user_id: string
  naam: string
  email: string
  mobiel_nummer: string
  datum_keuze: string
  claimed_at: string
  status: 'nieuw' | 'in_behandeling' | 'bevestigd' | 'afgewezen'
  contacted_at: string | null
  webhook_status: string
  fraud_status: string
}

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Claims konden niet worden geladen.')
  return response.json() as Promise<{ claims: Claim[] }>
}

const statussen: Claim['status'][] = ['nieuw', 'in_behandeling', 'bevestigd', 'afgewezen']

function csvWaarde(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

export function InvestAvondClaimsTab() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/invest-avond-claims', fetcher)
  const [zoekterm, setZoekterm] = useState('')
  const [statusFilter, setStatusFilter] = useState('alle')
  const [datumFilter, setDatumFilter] = useState('')
  const [bezigMet, setBezigMet] = useState<string | null>(null)

  const claims = useMemo(() => {
    const query = zoekterm.trim().toLowerCase()
    return (data?.claims ?? []).filter(claim => {
      const zoekMatch = !query || `${claim.naam} ${claim.email} ${claim.mobiel_nummer}`.toLowerCase().includes(query)
      const statusMatch = statusFilter === 'alle' || claim.status === statusFilter
      const datumMatch = !datumFilter || claim.datum_keuze === datumFilter
      return zoekMatch && statusMatch && datumMatch
    })
  }, [data, zoekterm, statusFilter, datumFilter])

  async function wijzigClaim(id: string, updates: { status?: Claim['status']; contacted?: boolean }) {
    setBezigMet(id)
    try {
      const response = await fetch('/api/admin/invest-avond-claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (!response.ok) throw new Error('Wijziging mislukt.')
      await mutate()
    } finally {
      setBezigMet(null)
    }
  }

  function exporteer() {
    const header = ['Naam', 'E-mail', 'Mobiel nummer', 'Datumkeuze', 'Geclaimd op', 'Status', 'Gecontacteerd', 'Webhook', 'Fraudecontrole']
    const regels = claims.map(claim => [
      claim.naam,
      claim.email,
      claim.mobiel_nummer,
      claim.datum_keuze,
      claim.claimed_at,
      claim.status,
      claim.contacted_at ?? '',
      claim.webhook_status,
      claim.fraud_status,
    ])
    const csv = [header, ...regels].map(regel => regel.map(csvWaarde).join(';')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `invest-avond-claims-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground"><RefreshCw size={18} className="animate-spin" />Claims laden…</div>
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-sm text-destructive">
        {error.message}
        <button type="button" onClick={() => mutate()} className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-foreground">Opnieuw proberen</button>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Zoek claims</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={zoekterm} onChange={event => setZoekterm(event.target.value)} placeholder="Zoek op naam, e-mail of mobiel…" className="w-full rounded-xl border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" aria-label="Filter op status">
          <option value="alle">Alle statussen</option>
          {statussen.map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
        </select>
        <input type="date" value={datumFilter} onChange={event => setDatumFilter(event.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" aria-label="Filter op gekozen datum" />
        <button type="button" onClick={exporteer} disabled={!claims.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          <Download size={15} />Exporteer CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-background text-xs text-muted-foreground">
              <tr>
                {['Naam', 'E-mail', 'Mobiel nummer', 'Datumkeuze', 'Geclaimd op', 'Status', 'Gecontacteerd', 'Controle'].map(kop => <th key={kop} className="px-4 py-3 font-semibold">{kop}</th>)}
              </tr>
            </thead>
            <tbody>
              {claims.map(claim => (
                <tr key={claim.id} className="border-t border-border align-middle">
                  <td className="px-4 py-3 font-semibold text-foreground">{claim.naam || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{claim.email}</td>
                  <td className="px-4 py-3 text-foreground">{claim.mobiel_nummer}</td>
                  <td className="px-4 py-3 font-semibold text-primary">{new Date(`${claim.datum_keuze}T00:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(claim.claimed_at).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3">
                    <select value={claim.status} disabled={bezigMet === claim.id} onChange={event => wijzigClaim(claim.id, { status: event.target.value as Claim['status'] })} className="rounded-lg border bg-background px-2 py-1.5 text-xs font-semibold outline-none">
                      {statussen.map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" disabled={bezigMet === claim.id} onClick={() => wijzigClaim(claim.id, { contacted: !claim.contacted_at })} className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: claim.contacted_at ? 'rgba(34,197,94,0.10)' : 'var(--secondary)', color: claim.contacted_at ? '#16a34a' : 'var(--secondary-foreground)' }}>
                      {claim.contacted_at && <Check size={13} />}{claim.contacted_at ? 'Ja' : 'Markeer'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className={claim.fraud_status === 'ok' ? 'text-muted-foreground' : 'font-semibold text-destructive'}>{claim.fraud_status}</span>
                      <span className="text-muted-foreground">{claim.webhook_status}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!claims.length && <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-muted-foreground">Geen claims gevonden.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{claims.length} claim{claims.length !== 1 ? 's' : ''} zichtbaar</p>
    </section>
  )
}
