'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { MapPin, Clock, ExternalLink } from 'lucide-react'
import type { DemoEvent } from '@/lib/types'

const EVENTBRITE_URL =
  'https://www.eventbrite.be/e/krijg-grip-op-je-geld-en-de-handvatten-om-het-te-laten-groeien-tickets-1995064585882?aff=oddtdtcreator&utm_source=archer&utm_medium=event-page&utm_campaign=content-network'

/** Presentatiedetails die niet in de database staan (foto, zaal, eindtijd, ticketlink). */
type EventMeta = {
  image: string
  venue: string
  venueSub: string
  locationLine: string
  endTime: string
  eventbriteUrl: string
}

const EVENT_META: Record<string, EventMeta> = {
  // Invest-avond — Handelsbeurs Antwerpen
  '5f5c5727-e86f-491c-a0e1-ebb8a018997a': {
    image: '/events/event-gent.jpg',
    venue: 'Handelsbeurs Antwerpen',
    venueSub: 'Een van de meest prestigieuze evenementenlocaties van de stad',
    locationLine: 'Handelsbeurs, Antwerpen',
    endTime: '22:00',
    eventbriteUrl: EVENTBRITE_URL,
  },
  // Van controle over je geld naar een vermogen dat voor je werkt — BluePoint Antwerpen
  'd25cb29d-6dd2-444a-ab4b-f64b23240385': {
    image: '/masterclass/mc-diner.jpg',
    venue: 'BluePoint Antwerpen',
    venueSub: 'Meetings, events & office space',
    locationLine: 'BluePoint, Antwerpen',
    endTime: '22:00',
    eventbriteUrl:
      'https://www.eventbrite.be/e/van-controle-over-je-geld-naar-een-vermogen-dat-voor-je-werkt-tickets-1997973081270?aff=oddtdtcreator&utm_source=archer&utm_medium=event-page&utm_campaign=content-network',
  },
}

function getEventMeta(event: DemoEvent): EventMeta {
  const known = EVENT_META[event.id]
  if (known) return known
  return {
    image: getEventImage(event),
    venue: event.location,
    venueSub: '',
    locationLine: event.location,
    endTime: '22:00',
    eventbriteUrl: EVENTBRITE_URL,
  }
}

const FALLBACK_EVENTS: DemoEvent[] = []

function getEventImage(event: DemoEvent): string {
  const loc = event.location?.toLowerCase() ?? ''
  if (loc.includes('antwerpen') || loc.includes('antwerp')) return '/events/event-antwerpen.jpg'
  if (loc.includes('gent') || loc.includes('ghent')) return '/events/event-gent.jpg'
  // fallback: try by id
  if (event.id === 'evt-1') return '/events/event-antwerpen.jpg'
  if (event.id === 'evt-2') return '/events/event-gent.jpg'
  return '/events/event-gent.jpg'
}

function formatDay(s: string) {
  return new Date(s).toLocaleDateString('nl-BE', { day: 'numeric' })
}
function formatMonth(s: string) {
  return new Date(s).toLocaleDateString('nl-BE', { month: 'short' }).replace('.', '').toUpperCase()
}
function formatWeekday(s: string) {
  const d = new Date(s).toLocaleDateString('nl-BE', { weekday: 'long' })
  return d.charAt(0).toUpperCase() + d.slice(1)
}
function formatTime(s: string) {
  // Always render in Belgian time (Europe/Brussels) so 16:00 local stays 16:00
  return new Date(s).toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Brussels',
  })
}

const VIDEOS = [
  {
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/0905_archergolf_V0.1_720p-k8Xg0Tnlp1phvOBbuJzm33zZ7UaB6V.mp4',
    title: 'Archer Golf Day',
    sub: 'Netwerken op een andere manier',
  },
  {
    src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Archer_Masterclass_HostedDinner_V2_720p-n43cVsV9PsJQRElDWP4Vb7zoIf8nwO.mp4',
    title: 'Hosted Dinner',
    sub: 'Een avond beleggen, eten en connecteren',
  },
]

function EventVideoPlayer() {
  const [active, setActive] = useState(0)

  return (
    <div>
      {/* Main player */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#080a10' }}>
        <video
          key={VIDEOS[active].src}
          src={VIDEOS[active].src}
          controls
          playsInline
          poster="/video-thumbnail.png"
          className="w-full block"
          style={{ aspectRatio: '16/9' }}
        />
      </div>

      {/* Tab switcher */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {VIDEOS.map((v, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="text-left rounded-xl px-4 py-3 transition-all"
            style={{
              background: active === i ? 'rgba(37,0,245,0.07)' : '#f8f9fd',
              border: `1.5px solid ${active === i ? 'rgba(37,0,245,0.2)' : '#e8ecf4'}`,
            }}
          >
            <p className="text-xs font-bold" style={{ color: active === i ? '#2500F5' : '#0d0f14' }}>
              {v.title}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(13,15,20,0.45)' }}>{v.sub}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function EventsPage() {
  const [events, setEvents] = useState<DemoEvent[]>(FALLBACK_EVENTS)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/events-data')
      if (!res.ok) return
      const d = await res.json()
      if (d.events && d.events.length > 0) setEvents(d.events as DemoEvent[])
    }
    load()
  }, [])

  return (
    <>
      <div className="max-w-3xl mx-auto pb-16">
        {/* ── Event card ──────────────────────────────────────── */}
        <div className="mb-10 space-y-4">
          {events.map((event) => {
            const spotsLow = event.spots_left <= 15
            const meta = getEventMeta(event)
            const imgSrc = meta.image

            return (
              <div
                key={event.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: '#fff',
                  border: '1px solid #e8ecf4',
                  boxShadow: '0 2px 12px rgba(13,15,20,0.06)',
                }}
              >
                {/* Photo */}
                <div className="relative w-full overflow-hidden" style={{ height: 220 }}>
                  <Image
                    src={imgSrc}
                    alt={event.title}
                    fill
                    className="object-cover"
                    sizes="100vw"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(8,10,20,0.82) 0%, rgba(8,10,20,0.15) 55%, transparent 100%)' }}
                  />
                  {/* Location badge */}
                  <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.18em] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        Locatie
                      </p>
                      <p className="text-xl font-extrabold text-white" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
                        {meta.venue}
                      </p>
                      {meta.venueSub && (
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {meta.venueSub}
                        </p>
                      )}
                    </div>
                    {spotsLow && (
                      <div
                        className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(255,255,255,0.92)', color: '#2500F5' }}
                      >
                        Nog {event.spots_left} plekken
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-4">

                  {/* Date + time */}
                  <div className="flex items-start gap-4">
                    <div
                      className="rounded-xl overflow-hidden text-center shrink-0"
                      style={{ width: 52, border: '1.5px solid #e8ecf4' }}
                    >
                      <div
                        className="text-[9px] font-bold uppercase py-1 tracking-wider"
                        style={{ background: '#2500F5', color: '#fff' }}
                      >
                        {formatMonth(event.starts_at)}
                      </div>
                      <div className="text-2xl font-extrabold py-1" style={{ color: '#0d0f14', lineHeight: 1.1 }}>
                        {formatDay(event.starts_at)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 pt-0.5">
                      <p className="text-base font-bold" style={{ color: '#0d0f14' }}>
                        {formatWeekday(event.starts_at)}
                      </p>
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(13,15,20,0.5)' }}>
                        <Clock size={12} style={{ color: '#2500F5' }} />
                        {formatTime(event.starts_at)} &ndash; {meta.endTime}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: 'rgba(13,15,20,0.5)' }}>
                        <MapPin size={12} style={{ color: '#2500F5' }} />
                        {meta.locationLine}
                      </div>
                    </div>
                    <div className="ml-auto text-right pt-0.5">
                      <span className="text-xl font-extrabold" style={{ color: '#0d0f14' }}>
                        &euro;&nbsp;{event.price_eur}
                      </span>
                      <p className="text-[10px]" style={{ color: 'rgba(13,15,20,0.38)' }}>per persoon</p>
                    </div>
                  </div>

                  <p className="text-sm" style={{ color: 'rgba(13,15,20,0.55)', lineHeight: 1.55 }}>
                    {event.description}
                  </p>

                  <a
                    href={meta.eventbriteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
                    style={{ background: '#2500F5', color: '#fff' }}
                  >
                    Reserveer je plaats op Eventbrite
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Afgelopen edities ────────────────���───────────────── */}
        <div className="mb-10">
          <h2 className="text-lg font-extrabold mb-1" style={{ color: '#0d0f14' }}>Hoe een Archer-dag eruitziet</h2>
          <p className="text-sm mb-5" style={{ color: 'rgba(13,15,20,0.45)' }}>
            Van golf tot hosted dinner — een blik achter de schermen.
          </p>

          <EventVideoPlayer />
        </div>

      </div>


    </>
  )
}
