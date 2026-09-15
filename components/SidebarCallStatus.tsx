'use client'

import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { CalendarCheck, CalendarPlus, Clock, MapPin, X } from 'lucide-react'
import { useApp } from './app-context'

const TZ_FALLBACK = 'Europe/Brussels'
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

/** Datum-onderdelen zoals ze in de doeltijdzone gelden (maand is 1-12). */
function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function formatFullDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone,
  }).format(date)
}

function formatShortDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('nl-BE', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone,
  }).format(date)
}

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('nl-BE', {
    hour: '2-digit', minute: '2-digit', timeZone,
  }).format(date)
}

/** Google Calendar wil UTC-timestamps in het formaat YYYYMMDDTHHMMSSZ. */
function toGCalStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function buildGoogleCalendarUrl(start: Date, end: Date) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Persoonlijk oriëntatiegesprek · Archer Invest',
    dates: `${toGCalStamp(start)}/${toGCalStamp(end)}`,
    details: 'Je persoonlijk oriëntatiegesprek met Archer Invest.',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Maandrooster (maandag-eerst) voor de maand van de afspraak. */
function buildMonthGrid(year: number, month1: number) {
  const monthIndex = month1 - 1
  const firstDow = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function SidebarCallStatus({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useApp()
  const [open, setOpen] = useState(false)

  if (!user?.call_booked) return null

  const timeZone = user.call_timezone || TZ_FALLBACK
  const start = user.call_start_at ? new Date(user.call_start_at) : null
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null
  const endRaw = user.call_end_at ? new Date(user.call_end_at) : null
  const end = endRaw && !Number.isNaN(endRaw.getTime())
    ? endRaw
    : validStart ? new Date(validStart.getTime() + 30 * 60 * 1000) : null

  const zoned = validStart ? getZonedParts(validStart, timeZone) : null
  const grid = zoned ? buildMonthGrid(zoned.year, zoned.month) : null
  const monthLabel = validStart
    ? new Intl.DateTimeFormat('nl-BE', { month: 'long', year: 'numeric', timeZone }).format(validStart)
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-left transition-colors"
        style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
      >
        <CalendarCheck size={14} className="shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold leading-tight">Oriëntatiegesprek</span>
          <span className="block text-[10px] leading-tight" style={{ color: 'rgba(37,0,245,0.7)' }}>
            {validStart
              ? `${formatShortDate(validStart, timeZone)} · ${formatTime(validStart, timeZone)}`
              : 'Ingepland'}
          </span>
        </span>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-foreground/45 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
            <Dialog.Popup className="flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl transition duration-200 data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 sm:rounded-3xl">
              <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    <CalendarCheck size={12} />
                    Ingepland
                  </span>
                  <Dialog.Title className="mt-2.5 text-lg font-bold text-balance">
                    Je oriëntatiegesprek
                  </Dialog.Title>
                </div>
                <Dialog.Close
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label="Sluiten"
                >
                  <X size={16} />
                </Dialog.Close>
              </header>

              {grid && zoned && monthLabel && validStart ? (
                <div className="px-6">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <p className="mb-3 text-center text-sm font-semibold capitalize">{monthLabel}</p>
                    <div className="grid grid-cols-7 gap-y-1.5 text-center">
                      {WEEKDAYS.map(day => (
                        <span key={day} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {day}
                        </span>
                      ))}
                      {grid.map((day, index) => {
                        const isDay = day === zoned.day
                        return (
                          <div key={index} className="flex items-center justify-center">
                            {day === null ? (
                              <span className="size-8" />
                            ) : (
                              <span
                                className={`flex size-8 items-center justify-center rounded-full text-xs ${
                                  isDay
                                    ? 'bg-primary font-bold text-primary-foreground'
                                    : 'text-foreground/70'
                                }`}
                              >
                                {day}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 px-6 pt-5">
                {validStart ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CalendarCheck size={16} />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Datum</p>
                        <p className="text-sm font-semibold capitalize">{formatFullDate(validStart, timeZone)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tijdstip</p>
                        <p className="text-sm font-semibold">
                          {formatTime(validStart, timeZone)}
                          {end ? ` – ${formatTime(end, timeZone)}` : ''}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CalendarCheck size={16} />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Je gesprek is ingepland. Je ontvangt de afspraakbevestiging met alle details per e-mail.
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Waar</p>
                    <p className="text-sm font-semibold">Online · link volgt per e-mail</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 px-6 pb-6 pt-6">
                {validStart && end ? (
                  <a
                    href={buildGoogleCalendarUrl(validStart, end)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onNavigate}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <CalendarPlus size={16} />
                    Toevoegen aan agenda
                  </a>
                ) : null}
                <Dialog.Close className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  Sluiten
                </Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
