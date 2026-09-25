'use client'

import { Check, Clock3, MessageCircle, Mail, Send, TriangleAlert } from 'lucide-react'
import { WORKFLOWS } from '@/lib/workflow-engine'
import { HUBSPOT_CODE } from '@/lib/hubspot-codes'

type FlowStatus = 'live' | 'planned' | 'retiring' | 'signal'
type FlowChannel = 'Mail' | 'WhatsApp' | 'Mail + WhatsApp' | 'Telegram'

interface FlowItem {
  number: number
  title: string
  trigger: string
  channel: FlowChannel
  status: FlowStatus
  requirement?: string
  workflow?: string
}

const FLOW: FlowItem[] = [
  { number: 1, title: 'Mail vermogenstest (activatie)', trigger: 'Bij invullen van de test', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + test-event' },
  { number: 2, title: 'WhatsApp vermogenstest', trigger: 'Direct, samen met mail 1', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + opt-in' },
  { number: 3, title: 'Mail Discovery (activatie)', trigger: 'Bij aanmaken van een Discovery-account', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + account-event' },
  { number: 4, title: 'WhatsApp Discovery', trigger: 'Direct, samen met mail 3', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + opt-in' },
  { number: 5, title: 'Mail dag 1', trigger: '24u na aanmaak, nog niet geactiveerd', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + activatiestatus' },
  { number: 6, title: 'Mail dag 3', trigger: '3 dagen na aanmaak, nog niet geactiveerd', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + activatiestatus' },
  { number: 7, title: 'Mail dag 5', trigger: '5 dagen na aanmaak, nog niet geactiveerd', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + activatiestatus' },
  { number: 8, title: 'Signaal 2/6 naar accountmanager', trigger: '2 video\'s voltooid', channel: 'Telegram', status: 'signal', requirement: 'Telegram-provider + owner-routing' },
  { number: 9, title: 'Mail video 2', trigger: '24u inactief, video 2 is de volgende ongeziene video', channel: 'Mail', status: 'live', workflow: 'video_2_herinnering' },
  { number: 10, title: 'Mail video 3', trigger: '24u inactief, video 3 is de volgende ongeziene video', channel: 'Mail', status: 'live', workflow: 'video_3_herinnering' },
  { number: 11, title: 'Mail video 4', trigger: '24u inactief, video 4 is de volgende ongeziene video', channel: 'Mail', status: 'live', workflow: 'video_4_herinnering' },
  { number: 12, title: 'Mail video 5', trigger: '24u inactief, video 5 is de volgende ongeziene video', channel: 'Mail', status: 'live', workflow: 'video_5_herinnering' },
  { number: 13, title: 'Mail video 6', trigger: '24u inactief, video 6 is de volgende ongeziene video', channel: 'Mail', status: 'live', workflow: 'video_6_herinnering' },
  { number: 14, title: 'Mail alle video\'s gezien', trigger: 'Zesde video voltooid', channel: 'Mail', status: 'live', workflow: 'alles_gezien_c1' },
  { number: 15, title: 'WhatsApp 6/6', trigger: 'Direct, samen met mail 14', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + video-6-event' },
  { number: 16, title: 'Melding editie geboekt', trigger: 'Bij het kiezen van een editie', channel: 'Telegram', status: 'signal', requirement: 'Telegram-provider + editie-event' },
  { number: 17, title: 'Melding strategiegesprek aangevraagd', trigger: 'Bij het aanvragen van een gesprek', channel: 'Telegram', status: 'signal', requirement: 'Telegram-provider + strategie-event' },
  { number: 18, title: 'Mail deactivatie dag 2', trigger: 'Geactiveerd, niet geboekt', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + deactivatie-evaluator' },
  { number: 19, title: 'Mail deactivatie dag 4', trigger: 'Geactiveerd, niet geboekt', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + deactivatie-evaluator' },
  { number: 20, title: 'Mail deactivatie dag 6', trigger: 'Geactiveerd, niet geboekt', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + deactivatie-evaluator' },
  { number: 21, title: 'Mail dag 7 (verlopen)', trigger: 'Trial verlopen zonder boeking', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + trial-status' },
]

const statusMeta: Record<FlowStatus, { label: string; className: string; icon: typeof Check }> = {
  live: { label: 'werkt nu', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Check },
  planned: { label: 'nog te koppelen', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock3 },
  retiring: { label: 'uit te faseren', className: 'bg-slate-100 text-slate-500 border-slate-200 line-through', icon: TriangleAlert },
  signal: { label: 'signaal, geen mail', className: 'bg-violet-50 text-violet-700 border-violet-200', icon: Send },
}

const channelIcon = { Mail, WhatsApp: MessageCircle, 'Mail + WhatsApp': Send, Telegram: Send }

export function MailFlowBlueprint() {
  const liveNames = new Set(WORKFLOWS.map(workflow => workflow.naam))
  const liveCount = FLOW.filter(item => item.workflow && liveNames.has(item.workflow)).length
  const plannedCount = FLOW.filter(item => item.status === 'planned').length
  const signalCount = FLOW.filter(item => item.status === 'signal').length

  return (
    <section aria-labelledby="official-flow-title" className="rounded-3xl border p-4 sm:p-6" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: '#2500F5' }}>Officiële flow</p>
          <h2 id="official-flow-title" className="mt-1 text-xl font-semibold" style={{ color: '#0d0f14' }}>Officiële flow — 21 contactmomenten</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: '#64748b' }}>Dezelfde regels als de evaluator: events, actuele status, resetbare timers en send-once. Normale “niet aan de beurt”-evaluaties verschijnen niet in de history.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{liveCount} werkt nu</span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{plannedCount} te koppelen</span>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-medium text-violet-700">{signalCount} signalen</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['1', 'Instroom & activatie', 'Vermogenstest en Discovery'],
          ['2', 'Niet geactiveerd', 'Dag 1, dag 3 en dag 5'],
          ['3', 'Kwalificatie', '2/6-signaal, video-nudges en 6/6'],
          ['4', 'Boeking & deactivatie', 'Editie, strategiegesprek en trial'],
        ].map(([number, title, description]) => (
          <div key={number} className="rounded-2xl border p-3" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <span className="text-[10px] font-bold" style={{ color: '#2500F5' }}>FASE {number}</span>
            <p className="mt-1 text-xs font-semibold" style={{ color: '#0f172a' }}>{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: '#64748b' }}>{description}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {(['Instroom & activatie', 'Niet geactiveerd', 'Kwalificatie', 'Boeking & deactivatie'] as const).map((phase, phaseIndex) => {
          const ranges = [[1, 4], [5, 7], [8, 15], [16, 21]][phaseIndex]
          const items = FLOW.filter(item => item.number >= ranges[0] && item.number <= ranges[1])
          return (
            <div key={phase} className="overflow-hidden rounded-2xl border" style={{ borderColor: '#e8ecf4' }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ background: '#f8fafc', borderColor: '#e8ecf4' }}>
                <h3 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: '#334155' }}>{phase}</h3>
                <span className="text-[10px]" style={{ color: '#94a3b8' }}>{items.length} momenten</span>
              </div>
              <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
                {items.map(item => {
                  const meta = statusMeta[item.status]
                  const StatusIcon = meta.icon
                  const ChannelIcon = channelIcon[item.channel]
                  return (
                    <div key={item.number} className="flex items-start gap-3 px-4 py-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: item.status === 'live' ? '#ecfdf5' : '#f1f5f9', color: item.status === 'live' ? '#15803d' : '#64748b' }}>{item.number}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>{item.title}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${meta.className}`}><StatusIcon className="size-2.5" />{meta.label}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: '#64748b' }}>{item.trigger}</p>
                        {item.requirement && <p className="mt-1 text-[10px]" style={{ color: '#2563eb' }}>Nodig: {item.requirement}</p>}
                        {item.channel === 'Mail' && (
                          <details className="mt-2 rounded-xl border px-2.5 py-2" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                            <summary className="cursor-pointer text-[10px] font-semibold" style={{ color: '#334155' }}>Wat gaat naar HubSpot?</summary>
                            <div className="mt-2 space-y-1 font-mono text-[9px] leading-relaxed" style={{ color: '#64748b' }}>
                              <p><span style={{ color: '#2500F5' }}>workflow</span>: {item.workflow ? (HUBSPOT_CODE[item.workflow] ?? item.workflow) : 'nog geen code gekoppeld'}</p>
                              <p><span style={{ color: '#2500F5' }}>email</span>: user.email</p>
                              <p><span style={{ color: '#2500F5' }}>naam</span>: user.name ?? &apos;&apos;</p>
                              <p><span style={{ color: '#2500F5' }}>contact_owner_email</span>: actuele eigenaar of null</p>
                              <p><span style={{ color: '#2500F5' }}>appointment_url</span>: booking link of null</p>
                              <p><span style={{ color: '#2500F5' }}>appointment_owner_name</span>: eigenaar van booking link of null</p>
                              <p><span style={{ color: '#2500F5' }}>appointment_link_is_fallback</span>: true/false/null</p>
                            </div>
                            <p className="mt-2 text-[9px] leading-relaxed" style={{ color: '#94a3b8' }}>De waarden met <code>user.</code> en “actuele” worden pas ingevuld bij het versturen. De centrale webhook ontvangt dit als één JSON-POST.</p>
                          </details>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-[10px]" style={{ color: '#94a3b8' }}><ChannelIcon className="size-3" />{item.channel}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border px-3 py-3" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
        <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: '#b45309' }} />
        <p className="text-[11px] leading-relaxed" style={{ color: '#92400e' }}><strong>Belangrijk:</strong> de groene kaarten gebruiken de bestaande evaluator en HubSpot-codes. Blauwe kaarten zijn visueel opgenomen in de officiële flow, maar worden pas actief nadat de ontbrekende eventbron, HubSpot-code of WhatsApp-provider is gekoppeld. De bestaande triggers worden niet automatisch omgezet.</p>
      </div>
    </section>
  )
}
