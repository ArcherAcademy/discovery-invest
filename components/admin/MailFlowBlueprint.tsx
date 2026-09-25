'use client'

import { Check, Clock3, MessageCircle, Mail, Send, TriangleAlert } from 'lucide-react'
import { WORKFLOWS } from '@/lib/workflow-engine'

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
  { number: 1, title: 'Vermogenstest: activatie', trigger: 'Direct bij invullen vermogenstest', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + instroom-event' },
  { number: 2, title: 'Vermogenstest: opvolging', trigger: 'Direct samen met mail 1', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + opt-in' },
  { number: 3, title: 'Discovery: activatie', trigger: 'Direct bij accountaanmaak', channel: 'Mail', status: 'live', workflow: 'welkom' },
  { number: 4, title: 'Discovery: opvolging', trigger: 'Direct samen met mail 3', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + opt-in' },
  { number: 5, title: 'New lead: dag 1', trigger: '24u na aanmaak, zonder activiteit', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + activiteit-event', workflow: 'activatie_24u' },
  { number: 6, title: 'New lead: dag 3', trigger: '3 dagen na aanmaak, zonder activiteit', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + activiteit-event', workflow: 'activatie_72u' },
  { number: 7, title: 'New lead: dag 5', trigger: '5 dagen na aanmaak, zonder activiteit', channel: 'Mail', status: 'planned', requirement: 'HubSpot-code + activiteit-event' },
  { number: 8, title: 'Na belpoging 1', trigger: 'Direct na mislukte poging 1', channel: 'Mail', status: 'planned', requirement: 'Sales-call event + HubSpot-code' },
  { number: 9, title: 'Na belpoging 1', trigger: 'Samen met mail 8', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + call event' },
  { number: 10, title: 'Na belpoging 2', trigger: 'Na mislukte poging 2', channel: 'Mail', status: 'planned', requirement: 'Sales-call event + HubSpot-code' },
  { number: 11, title: 'No Contact nurture', trigger: 'Na 3 pogingen of 7 dagen stil', channel: 'Mail', status: 'planned', requirement: 'Leadstatus + nurture-code' },
  { number: 12, title: 'Kwalificatiesignaal', trigger: 'Op het moment dat video 2 klaar is', channel: 'Telegram', status: 'signal', requirement: 'Telegram-provider + owner-routing' },
  { number: 13, title: 'Video 2 nudge', trigger: '24u inactief, video 2 eerstvolgend', channel: 'Mail', status: 'live', workflow: 'video_2_herinnering' },
  { number: 14, title: 'Video 3 nudge', trigger: '24u inactief, video 3 eerstvolgend', channel: 'Mail', status: 'live', workflow: 'video_3_herinnering' },
  { number: 15, title: 'Video 4 nudge', trigger: '24u inactief, video 4 eerstvolgend', channel: 'Mail', status: 'live', workflow: 'video_4_herinnering' },
  { number: 16, title: 'Video 5 nudge', trigger: '24u inactief, video 5 eerstvolgend', channel: 'Mail', status: 'live', workflow: 'video_5_herinnering' },
  { number: 17, title: 'Video 6 nudge', trigger: '24u inactief, video 6 eerstvolgend', channel: 'Mail', status: 'live', workflow: 'video_6_herinnering' },
  { number: 18, title: 'Alle video\'s gezien', trigger: 'Direct na voltooiing video 6', channel: 'Mail', status: 'live', workflow: 'alles_gezien_c1' },
  { number: 19, title: 'Alle video\'s gezien', trigger: 'Samen met mail 18 + editie-push', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + editie-event' },
  { number: 20, title: 'Waitlist website', trigger: 'Direct bij websiteformulier', channel: 'Mail', status: 'planned', requirement: 'Waitlist-event + HubSpot-code' },
  { number: 21, title: 'Waitlist website', trigger: 'Samen met mail 20', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + opt-in' },
  { number: 22, title: 'Waitlist Discovery', trigger: 'Direct bij Discovery-instroom', channel: 'Mail', status: 'planned', requirement: 'Waitlist-event + HubSpot-code' },
  { number: 23, title: 'Waitlist Discovery', trigger: 'Samen met mail 22', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + opt-in' },
  { number: 24, title: 'Kennismaking bevestigd', trigger: 'Direct na betaalde inschrijving', channel: 'Mail', status: 'planned', requirement: 'Event-payment event + HubSpot-code' },
  { number: 25, title: 'Kennismaking reminder', trigger: '1 week voor event', channel: 'Mail', status: 'live', requirement: 'Eventbooking + timing', workflow: 'workshop_1w_voor' },
  { number: 26, title: 'Kennismaking reminder', trigger: '1 dag voor event', channel: 'Mail', status: 'planned', requirement: 'Eventbooking + timing' },
  { number: 27, title: 'Kennismaking reminder', trigger: '1 dag voor event', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + eventbooking' },
  { number: 28, title: 'Strategy meeting bevestigd', trigger: 'Direct na afspraak', channel: 'Mail', status: 'planned', requirement: 'Meeting-booked event + HubSpot-code' },
  { number: 29, title: 'Strategy meeting reminder', trigger: '1 week voor afspraak', channel: 'Mail', status: 'planned', requirement: 'Meeting-booked event + timing' },
  { number: 30, title: 'Strategy meeting reminder', trigger: '1 dag voor afspraak', channel: 'Mail', status: 'planned', requirement: 'Meeting-booked event + timing' },
  { number: 31, title: 'Strategy meeting reminder', trigger: '1 dag of 2u voor afspraak', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + meeting event' },
  { number: 32, title: 'Masterclass extra', trigger: 'Bij inschrijving editie', channel: 'WhatsApp', status: 'planned', requirement: 'WhatsApp-provider + editie-event' },
  { number: 33, title: 'Trial verloopt: dag 2', trigger: 'Geactiveerd, niet geboekt, binnen venster', channel: 'Mail', status: 'live', workflow: 'verloopt_5d' },
  { number: 34, title: 'Trial verloopt: dag 4', trigger: 'Geactiveerd, niet geboekt, dichter bij verval', channel: 'Mail', status: 'live', workflow: 'verloopt_3d' },
  { number: 35, title: 'Trial verloopt: dag 6', trigger: 'Geactiveerd, niet geboekt, vlak voor verval', channel: 'Mail', status: 'live', workflow: 'verloopt_1d' },
  { number: 36, title: 'Trial verlopen', trigger: 'Trial verstreken zonder boeking', channel: 'Mail', status: 'live', workflow: 'trial_verlopen' },
  { number: 37, title: 'Qualified: Marketing nurture', trigger: 'Lead koopt nu niet, stopt bij nieuwe activiteit', channel: 'Mail', status: 'planned', requirement: 'Leadstatus + nurture-code' },
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

  return (
    <section aria-labelledby="official-flow-title" className="rounded-3xl border p-4 sm:p-6" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: '#2500F5' }}>Officiële flow</p>
          <h2 id="official-flow-title" className="mt-1 text-xl font-semibold" style={{ color: '#0d0f14' }}>Mailflow 1 — 37 contactmomenten</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: '#64748b' }}>Dezelfde regels als de evaluator: events, actuele status, resetbare timers en send-once. Normale “niet aan de beurt”-evaluaties verschijnen niet in de history.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{liveCount} werkt nu</span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{plannedCount} te koppelen</span>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-medium text-violet-700">1 signaal</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['1', 'Instroom', 'Vermogenstest, Discovery en directe opvolging'],
          ['2', 'Leadstatus', 'Activatie, salespogingen en nurture'],
          ['3', 'Discovery', 'Video-nudges en 6/6 conversie'],
          ['4', 'Boeking & retentie', 'Waitlist, afspraken, trial en editie'],
        ].map(([number, title, description]) => (
          <div key={number} className="rounded-2xl border p-3" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <span className="text-[10px] font-bold" style={{ color: '#2500F5' }}>FASE {number}</span>
            <p className="mt-1 text-xs font-semibold" style={{ color: '#0f172a' }}>{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: '#64748b' }}>{description}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {(['Instroom', 'Leadstatus', 'Discovery', 'Boeking & retentie'] as const).map((phase, phaseIndex) => {
          const ranges = [[1, 4], [5, 11], [12, 19], [20, 37]][phaseIndex]
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
