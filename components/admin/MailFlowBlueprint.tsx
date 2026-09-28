'use client'

import { Check, Clock3, Mail, Send, TriangleAlert } from 'lucide-react'
import { HUBSPOT_CODE } from '@/lib/hubspot-codes'

type FlowStatus = 'instant' | 'cron' | 'funnel' | 'retiring' | 'review'
type FlowChannel = 'Mail' | 'Form-submit' | 'Funnel-event' | 'Oude route'

interface FlowItem {
  number: number
  title: string
  trigger: string
  destination: string
  channel: FlowChannel
  status: FlowStatus
  workflow?: string
  note?: string
}

const CRON_NOTE = 'Vertrekt, maar de evaluator loopt elke run in een 504-timeout na 300s en voltooit zijn run niet betrouwbaar. Gemiste vensters worden niet ingehaald. Een HubSpot-202 betekent aangenomen, niet afgeleverd.'
const FUNNEL_NOTE = 'Vertrekt niet: WEBHOOK_ENDPOINT ontbreekt. Het event kan intern wel gelogd worden.'

const FLOW: FlowItem[] = [
  { number: 1, title: 'mail_1_welkom', trigger: 'Bij de eerste geldige activatie van het account', destination: 'HubSpot mail-webhook', channel: 'Mail', status: 'instant', workflow: 'welkom' },
  { number: 2, title: 'trial.account_created', trigger: 'Direct nadat een nieuw Discovery-account is aangemaakt', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 3, title: 'trial.account_activated', trigger: 'Bij de eerste geldige activatie van het account', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 4, title: 'activatiemails 2u / 24u / 72u', trigger: 'Na respectievelijk 2, 24 of 72 uur, wanneer het account nog niet geactiveerd is', destination: 'HubSpot mail-webhook', channel: 'Mail', status: 'cron', workflow: 'activatie_2u', note: CRON_NOTE },
  { number: 5, title: 'video.started', trigger: 'Wanneer een kern- of bonusvideo wordt gestart', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 6, title: 'video.progress', trigger: 'Bij het opslaan van videovoortgang', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 7, title: 'video.completed', trigger: 'Bij de eerste succesvolle voltooiing van een video', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 8, title: 'lead.qualified', trigger: 'Exact bij voltooiing van de tweede kernvideo', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 9, title: 'video-nudges video 2 t/m 6', trigger: 'Wanneer de betreffende video de eerstvolgende ongeziene video is en de lead 24 uur inactief is', destination: 'HubSpot mail-webhook', channel: 'Mail', status: 'cron', workflow: 'video_2_herinnering', note: CRON_NOTE },
  { number: 10, title: 'mail_10_dag4', trigger: 'Vier dagen na 6/6 wanneer geen event geboekt is', destination: 'HubSpot mail-webhook', channel: 'Mail', status: 'review', workflow: 'dag4_inactief', note: "Herbekijken: de conditie moet van 'geen event geboekt' naar 'geen editie gekozen'." },
  { number: 11, title: 'videos.all_completed', trigger: 'De eerste keer dat alle zes kernvideo’s voltooid zijn', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 12, title: 'mail_11_alles_gezien', trigger: 'Direct nadat video 6 de zesde voltooide kernvideo maakt', destination: 'HubSpot mail-webhook', channel: 'Mail', status: 'instant', workflow: 'alles_gezien_c1' },
  { number: 13, title: 'bonus.unlocked', trigger: 'Wanneer alle zes kernvideo’s voltooid zijn', destination: 'Funnel-event', channel: 'Funnel-event', status: 'funnel', note: FUNNEL_NOTE },
  { number: 14, title: 'Masterclass-editie kiezen', trigger: 'Wanneer de lead na 6/6 een datum kiest en op “Kies je datum” klikt', destination: 'HubSpot form-submit — formulier 8492815c', channel: 'Form-submit', status: 'instant' },
  { number: 15, title: 'Editie geboekt / strategiegesprek', trigger: 'De huidige editie-popup doet een form-submit; /api/call-booking registreert een strategiegesprek', destination: 'Form-submit of database; geen workflow of extern funnel-event', channel: 'Funnel-event', status: 'funnel', note: 'De popup verstuurt formulier 8492815c. /api/call-booking schrijft alleen in de database en vuurt zelf geen melding of funnel-event af.' },
  { number: 16, title: 'mail_15 t/m 19 — verloopreeks 5d / 3d / 1d / 6u / verlopen', trigger: 'Binnen het resterende trialvenster, of zodra trial_expires_at verstreken is, zolang er niet geboekt is', destination: 'HubSpot mail-webhook', channel: 'Mail', status: 'cron', workflow: 'verloopt_5d', note: `${CRON_NOTE} Deze reeks hoort niet bij workshop/event.` },
]

const RETIRING: FlowItem[] = [
  { number: 17, title: 'mail_12_workshop_48u', trigger: 'Oude eventboeking binnen het ingestelde venster', destination: 'HubSpot mail-webhook', channel: 'Oude route', status: 'retiring', workflow: 'workshop_1w_voor' },
  { number: 18, title: 'mail_13_workshop_laatste_dag', trigger: 'Geen trigger aanwezig', destination: 'HubSpot mail-webhook', channel: 'Oude route', status: 'retiring', workflow: 'mail_13_workshop_laatste_dag' },
  { number: 19, title: 'mail_14_workshop_bevestiging', trigger: 'Alleen via de oude directe boekingsroute', destination: 'HubSpot mail-webhook', channel: 'Oude route', status: 'retiring', workflow: 'workshop_bevestiging' },
  { number: 20, title: 'event.booked', trigger: 'Alleen via oude boekingsroutes; geen frontend-caller meer', destination: 'Funnel-event', channel: 'Oude route', status: 'retiring', note: FUNNEL_NOTE },
  { number: 21, title: 'event.booking_cancelled', trigger: 'Alleen via oude boekingsroutes; geen frontend-caller meer', destination: 'Funnel-event', channel: 'Oude route', status: 'retiring', note: FUNNEL_NOTE },
  { number: 22, title: 'event.ticket_unlocked', trigger: 'Alle zes kernvideo’s voltooid', destination: 'Funnel-event', channel: 'Oude route', status: 'retiring', note: FUNNEL_NOTE },
  { number: 23, title: '/api/book-event', trigger: 'Oude boekingsroute; geen frontend-caller meer', destination: 'Geen huidige frontendbestemming', channel: 'Oude route', status: 'retiring' },
]

const statusMeta: Record<FlowStatus, { label: string; className: string; icon: typeof Check }> = {
  instant: { label: 'INSTANT — betrouwbaar', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Check },
  cron: { label: 'CRON-GESTUURD — onbetrouwbaar', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: Clock3 },
  funnel: { label: 'FUNNEL-EVENT — vertrekt niet', className: 'border-orange-200 bg-orange-50 text-orange-800', icon: Send },
  review: { label: 'HERBEKIJKEN', className: 'border-yellow-200 bg-yellow-50 text-yellow-800', icon: TriangleAlert },
  retiring: { label: 'GAAT WEG', className: 'border-slate-200 bg-slate-100 text-slate-500 line-through', icon: TriangleAlert },
}

const channelIcon = { Mail, 'Form-submit': Send, 'Funnel-event': Send, 'Oude route': TriangleAlert }

function FlowRow({ item }: { item: FlowItem }) {
  const meta = statusMeta[item.status]
  const StatusIcon = meta.icon
  const ChannelIcon = channelIcon[item.channel]
  const isRetiring = item.status === 'retiring'

  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${isRetiring ? 'opacity-60' : ''}`}>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">{item.number}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={`text-xs font-semibold ${isRetiring ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{item.title}</p>
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${meta.className}`}><StatusIcon className="size-2.5" />{meta.label}</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.trigger}</p>
        <p className="mt-1 text-[10px] text-slate-600">Bestemming: <span className="font-medium">{item.destination}</span></p>
        {item.note && <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{item.note}</p>}
        {item.channel === 'Mail' && item.workflow && (
          <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
            <summary className="cursor-pointer text-[10px] font-semibold text-slate-600">Wat gaat naar HubSpot?</summary>
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-slate-500"><span className="text-[#2500F5]">workflow</span>: {HUBSPOT_CODE[item.workflow] ?? item.workflow}</p>
            <p className="mt-2 text-[9px] leading-relaxed text-slate-400">De centrale webhook ontvangt dit als één JSON-POST. Een 202 betekent aangenomen, niet afgeleverd.</p>
          </details>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400"><ChannelIcon className="size-3" />{item.channel}</span>
    </div>
  )
}

export function MailFlowBlueprint() {
  const instantCount = FLOW.filter(item => item.status === 'instant').length
  const cronCount = FLOW.filter(item => item.status === 'cron').length
  const funnelCount = FLOW.filter(item => item.status === 'funnel').length

  return (
    <section aria-labelledby="official-flow-title" className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2500F5]">Integratie- en mailflow</p>
          <h2 id="official-flow-title" className="mt-1 text-xl font-semibold text-slate-900">Discovery workflows</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">De actuele status van mails, formulierverzendingen en funnel-events — zonder tokens of ruwe data.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-medium">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">{instantCount} instant</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">{cronCount} cron-onbetrouwbaar</span>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-800">{funnelCount} funnel-events</span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-500">{RETIRING.length} gaat weg</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-900"><strong>Belangrijk: evaluator-timeout.</strong> Elke cronrun eindigt na 300 seconden in een 504. De mails vertrekken wel, maar de run voltooit niet betrouwbaar; gemiste vensters worden niet ingehaald en een HubSpot-202 betekent aangenomen, niet afgeleverd.</p>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-orange-700" />
          <p className="text-[11px] leading-relaxed text-orange-900"><strong>WEBHOOK_ENDPOINT ontbreekt.</strong> Funnel-events worden intern gelogd, maar vertrekken momenteel niet naar een externe bestemming.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Leadflow — instant, cron en funnel</h3></div>
          <div className="divide-y divide-slate-100">{FLOW.map(item => <FlowRow key={item.number} item={item} />)}</div>
        </div>
        <div className="h-fit overflow-hidden rounded-2xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-3"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Gaat weg — workshop/event</h3><p className="mt-1 text-[10px] text-slate-400">Uitgefaseerd en daarom grijs weergegeven.</p></div>
          <div className="divide-y divide-slate-100">{RETIRING.map(item => <FlowRow key={item.number} item={item} />)}</div>
        </div>
      </div>
    </section>
  )
}
