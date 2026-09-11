'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, RefreshCw, Send, CheckCircle2, AlertTriangle, MailWarning } from 'lucide-react'

const COBALT = '#2500F5'
const BORDER = '#e8ecf4'
const TEXT = '#0d0f14'
const TEXT_DIM = 'rgba(13,15,20,0.45)'
const GREEN = '#16a34a'
const RED = '#ef4444'

interface Kandidaat {
  user_id: string
  email: string
  naam: string
  all_completed_at: string | null
  intern: boolean
}

interface Resultaat {
  email: string
  naam: string
  status: 'verstuurd' | 'gefaald'
  response: string | null
}

interface Rapport {
  verstuurd: number
  gefaald: number
  genegeerd: number
  resultaten: Resultaat[]
}

function formatDatum(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Eenmalige inhaalronde voor de alles-gezien mail.
 * Twee fasen: preview met selectie, daarna pas versturen.
 */
export function InhaalrondeModal({ onClose }: { onClose: () => void }) {
  const [laden, setLaden] = useState(true)
  const [kandidaten, setKandidaten] = useState<Kandidaat[]>([])
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set())
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)
  const [rapport, setRapport] = useState<Rapport | null>(null)
  // Tweede, expliciete handeling voordat er ook maar iets vertrekt. Zonder
  // deze stap start één klik meteen tientallen echte mails naar klanten.
  const [bevestigen, setBevestigen] = useState(false)

  const laadPreview = useCallback(async () => {
    setLaden(true)
    setFout(null)
    try {
      const res = await fetch('/api/admin/inhaalronde-alles-gezien')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setFout(data?.error ?? 'Preview kon niet geladen worden.')
        return
      }
      const lijst = data.kandidaten as Kandidaat[]
      setKandidaten(lijst)
      // Standaard alles aangevinkt, behalve interne adressen
      setGeselecteerd(new Set(lijst.filter(k => !k.intern).map(k => k.user_id)))
    } catch {
      setFout('Preview kon niet geladen worden — netwerkfout.')
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => { laadPreview() }, [laadPreview])

  function toggle(id: string) {
    // Wie de selectie nog wijzigt, bevestigt opnieuw — anders staat er een
    // bevestiging voor een aantal dat intussen veranderd is.
    setBevestigen(false)
    setGeselecteerd(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function verstuur() {
    if (bezig || geselecteerd.size === 0) return
    setBezig(true)
    setFout(null)
    try {
      const res = await fetch('/api/admin/inhaalronde-alles-gezien', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...geselecteerd] }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setFout(data?.error ?? 'Versturen mislukt.')
        return
      }
      setRapport({
        verstuurd: data.verstuurd,
        gefaald: data.gefaald,
        genegeerd: data.genegeerd,
        resultaten: data.resultaten,
      })
    } catch {
      setFout('Versturen mislukt — netwerkfout.')
    } finally {
      setBezig(false)
    }
  }

  const aantal = geselecteerd.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,15,20,0.45)' }}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden" style={{ background: '#fff' }}>

        {/* Kop */}
        <div className="flex items-start justify-between px-6 py-5 border-b shrink-0" style={{ borderColor: BORDER }}>
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(37,0,245,0.08)' }}>
              <MailWarning size={16} style={{ color: COBALT }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: TEXT }}>Inhaalronde: alles gezien</h2>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: TEXT_DIM }}>
                Eenmalige actie voor wie 6/6 haalde vóór de codefix en de mail nooit kreeg.
                Verstuurt <span className="font-mono">mail_11_alles_gezien</span>.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-60 shrink-0" aria-label="Sluiten">
            <X size={18} style={{ color: TEXT_DIM }} />
          </button>
        </div>

        {/* Inhoud */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {laden && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <RefreshCw size={14} className="animate-spin" style={{ color: COBALT }} />
              <span className="text-xs" style={{ color: TEXT_DIM }}>Doelgroep bepalen…</span>
            </div>
          )}

          {!laden && fout && !rapport && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.08)' }}>
              <AlertTriangle size={14} style={{ color: RED }} className="mt-0.5 shrink-0" />
              <p className="text-xs font-semibold" style={{ color: RED }}>{fout}</p>
            </div>
          )}

          {/* Rapport na afloop */}
          {rapport && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: 'rgba(22,163,74,0.1)', color: GREEN }}>
                  {rapport.verstuurd} verstuurd
                </span>
                {rapport.gefaald > 0 && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: RED }}>
                    {rapport.gefaald} gefaald
                  </span>
                )}
                {rapport.genegeerd > 0 && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: '#f0f3fb', color: TEXT_DIM }}>
                    {rapport.genegeerd} overgeslagen
                  </span>
                )}
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
                {rapport.resultaten.map((r, i) => (
                  <div
                    key={r.email}
                    className="flex items-center gap-3 px-3 py-2"
                    style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}
                  >
                    {r.status === 'verstuurd'
                      ? <CheckCircle2 size={13} style={{ color: GREEN }} className="shrink-0" />
                      : <AlertTriangle size={13} style={{ color: RED }} className="shrink-0" />}
                    <span className="text-xs flex-1 truncate" style={{ color: TEXT }}>{r.email}</span>
                    <span className="text-[10px] font-mono shrink-0" style={{ color: r.status === 'verstuurd' ? GREEN : RED }}>
                      {r.response ?? r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview met selectie */}
          {!laden && !rapport && kandidaten.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEXT_DIM }}>
                  {kandidaten.length} in aanmerking
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setBevestigen(false); setGeselecteerd(new Set(kandidaten.filter(k => !k.intern).map(k => k.user_id))) }}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                    style={{ background: '#f0f3fb', color: TEXT_DIM }}
                  >
                    Alleen externe
                  </button>
                  <button
                    onClick={() => { setBevestigen(false); setGeselecteerd(new Set()) }}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                    style={{ background: '#f0f3fb', color: TEXT_DIM }}
                  >
                    Geen
                  </button>
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
                {kandidaten.map((k, i) => {
                  const aan = geselecteerd.has(k.user_id)
                  return (
                    <label
                      key={k.user_id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-[#fafbff]"
                      style={{ borderTop: i === 0 ? 'none' : `1px solid ${BORDER}` }}
                    >
                      <input
                        type="checkbox"
                        checked={aan}
                        onChange={() => toggle(k.user_id)}
                        className="shrink-0 w-3.5 h-3.5 cursor-pointer"
                        style={{ accentColor: COBALT }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate" style={{ color: TEXT }}>
                            {k.naam || '(geen naam)'}
                          </span>
                          {k.intern && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-semibold"
                              style={{ background: 'rgba(180,83,9,0.1)', color: '#b45309' }}>
                              intern
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] truncate block" style={{ color: TEXT_DIM }}>{k.email}</span>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: TEXT_DIM }}>
                        {formatDatum(k.all_completed_at)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {!laden && !rapport && kandidaten.length === 0 && !fout && (
            <div className="py-8 text-center">
              <CheckCircle2 size={20} style={{ color: GREEN }} className="mx-auto mb-2" />
              <p className="text-xs font-semibold" style={{ color: TEXT }}>Niemand komt nog in aanmerking.</p>
              <p className="text-xs mt-1" style={{ color: TEXT_DIM }}>De inhaalronde is al uitgevoerd.</p>
            </div>
          )}
        </div>

        {/* Voet */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: BORDER, background: '#fafbff' }}>
          {rapport ? (
            <>
              <p className="text-xs" style={{ color: TEXT_DIM }}>Klaar. De verstuurde mails staan in de trigger-log.</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold shrink-0"
                style={{ background: COBALT, color: '#fff' }}
              >
                Sluiten
              </button>
            </>
          ) : bevestigen ? (
            <>
              <p className="text-xs font-semibold" style={{ color: RED }}>
                {`Dit verstuurt nu ${aantal} echte ${aantal === 1 ? 'mail' : 'mails'}. Dit kan niet ongedaan gemaakt worden.`}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setBevestigen(false)}
                  disabled={bezig}
                  className="px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                  style={{ background: '#eef1f7', color: TEXT }}
                >
                  Annuleer
                </button>
                <button
                  onClick={verstuur}
                  disabled={bezig}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: RED, color: '#fff' }}
                >
                  {bezig ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                  {bezig ? 'Bezig met versturen…' : `Ja, verstuur ${aantal} ${aantal === 1 ? 'mail' : 'mails'}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs" style={{ color: TEXT_DIM }}>
                {aantal === 0 ? 'Niemand geselecteerd.' : `${aantal} geselecteerd van ${kandidaten.length}.`}
              </p>
              <button
                onClick={() => setBevestigen(true)}
                disabled={aantal === 0 || laden}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: COBALT, color: '#fff' }}
              >
                <Send size={12} />
                {`Verstuur naar ${aantal} ${aantal === 1 ? 'persoon' : 'mensen'}…`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
