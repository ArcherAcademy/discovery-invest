'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Dialog } from '@base-ui/react/dialog'
import { ArrowRight, CalendarDays, CheckCircle2, LoaderCircle, Lock, RotateCw, X } from 'lucide-react'
import { useApp } from '@/components/app-context'
import { Button } from '@/components/ui/button'

interface BookingResponse {
  available: boolean
  booking_url?: string
  owner_name?: string | null
}

interface CallBookingBlockProps {
  unlocked: boolean
  variant?: 'card' | 'milestone' | 'sidebar'
  openRequest?: number
}

type BookingAction = 'opened' | 'booked'
type DialogStatus = 'booking' | 'saving' | 'booked' | 'error'

const fetcher = async (url: string): Promise<BookingResponse> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Boekingslink kon niet worden geladen')
  return response.json()
}

interface BookingDetailsInput {
  start_at?: string | number
  end_at?: string | number
  duration_minutes?: string | number
  timezone?: string | number
  subject?: string | number
  contact_id?: string | number
  organizer_name?: string | number
}

async function registerBookingAction(action: BookingAction, booking?: BookingDetailsInput) {
  const response = await fetch('/api/call-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, booking }),
  })
  if (!response.ok) throw new Error('De boekingsstatus kon niet worden bijgewerkt')
  return response.json()
}

function getEmbedUrl(bookingUrl: string) {
  const url = new URL(bookingUrl)
  url.searchParams.set('embed', 'true')
  return url.toString()
}

function formatAppointment(startAt: string | null | undefined, timezone?: string | null) {
  if (!startAt) return null
  const date = new Date(startAt)
  if (Number.isNaN(date.getTime())) return null

  const timeZone = timezone || 'Europe/Brussels'
  try {
    const datePart = new Intl.DateTimeFormat('nl-BE', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone,
    }).format(date)
    const timePart = new Intl.DateTimeFormat('nl-BE', {
      hour: '2-digit', minute: '2-digit', timeZone,
    }).format(date)
    return { datePart, timePart }
  } catch {
    return null
  }
}

function isAllowedHubSpotOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' && /^meetings(?:-[a-z0-9]+)?\.hubspot\.com$/i.test(url.hostname)
  } catch {
    return false
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function findScalar(root: unknown, keys: string[], depth = 0): string | number | undefined {
  const record = asRecord(root)
  if (!record || depth > 6) return undefined
  const wanted = new Set(keys.map(key => key.toLowerCase()))

  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(key.toLowerCase()) && (typeof value === 'string' || typeof value === 'number')) return value
  }
  for (const value of Object.values(record)) {
    const found = findScalar(value, keys, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

function getSuccessfulBookingDetails(event: MessageEvent): BookingDetailsInput | null {
  if (!isAllowedHubSpotOrigin(event.origin)) return null

  let payload: unknown = event.data
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return null
    }
  }

  const message = asRecord(payload)
  if (message?.meetingBookSucceeded !== true) return null
  const meetingsPayload = asRecord(message.meetingsPayload)
  const bookingResponse = asRecord(meetingsPayload?.bookingResponse)
  const postResponse = asRecord(bookingResponse?.postResponse)
  const bookingEvent = asRecord(bookingResponse?.event)
  const timerange = asRecord(postResponse?.timerange)
  const organizer = asRecord(postResponse?.organizer)
  const searchRoot = bookingResponse ?? meetingsPayload ?? message

  return {
    start_at: findScalar(timerange, ['start'])
      ?? findScalar(bookingEvent, ['dateTime', 'date_time'])
      ?? findScalar(searchRoot, ['startTime', 'start_time', 'startAt', 'start_at']),
    end_at: findScalar(timerange, ['end'])
      ?? findScalar(searchRoot, ['endTime', 'end_time', 'endAt', 'end_at']),
    duration_minutes: findScalar(bookingEvent, ['duration'])
      ?? findScalar(searchRoot, ['durationMinutes', 'duration_minutes']),
    timezone: findScalar(bookingEvent, ['timezone', 'timeZone', 'time_zone'])
      ?? findScalar(searchRoot, ['timezone', 'timeZone', 'time_zone']),
    subject: findScalar(bookingEvent, ['subject', 'title', 'meetingName', 'meeting_name'])
      ?? findScalar(searchRoot, ['subject', 'title', 'meetingName', 'meeting_name']),
    contact_id: findScalar(postResponse?.contact, ['contactId', 'contact_id', 'userId', 'vid'])
      ?? findScalar(searchRoot, ['contactId', 'contact_id', 'vid']),
    organizer_name: findScalar(organizer, ['fullName', 'name'])
      ?? findScalar(searchRoot, ['organizerName', 'organizer_name', 'hostName', 'host_name']),
  }
}

export default function CallBookingBlock({ unlocked, variant = 'card', openRequest = 0 }: CallBookingBlockProps) {
  const { user, refresh } = useApp()
  const { data, error, isLoading, mutate } = useSWR<BookingResponse>(unlocked ? '/api/call-booking' : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })
  const [open, setOpen] = useState(false)
  const [frameLoaded, setFrameLoaded] = useState(false)
  const [frameKey, setFrameKey] = useState(0)
  const [status, setStatus] = useState<DialogStatus>('booking')
  const savingRef = useRef(false)
  const handledOpenRequestRef = useRef(0)

  useEffect(() => {
    if (!open) return

    async function handleBookingMessage(event: MessageEvent) {
      const bookingDetails = getSuccessfulBookingDetails(event)
      if (savingRef.current || !bookingDetails) return

      savingRef.current = true
      setStatus('saving')
      try {
        await registerBookingAction('booked', bookingDetails)
        await Promise.all([refresh(), mutate()])
        setStatus('booked')
      } catch {
        setStatus('error')
      } finally {
        savingRef.current = false
      }
    }

    window.addEventListener('message', handleBookingMessage)
    return () => window.removeEventListener('message', handleBookingMessage)
  }, [open, refresh, mutate])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) return

    setFrameLoaded(false)
    setStatus('booking')
    void registerBookingAction('opened').catch(() => {
      setStatus('error')
    })
  }

  useEffect(() => {
    if (!unlocked || openRequest === 0 || handledOpenRequestRef.current === openRequest) return

    handledOpenRequestRef.current = openRequest
    handleOpenChange(true)
  }, [openRequest, unlocked]) // eslint-disable-line react-hooks/exhaustive-deps

  function retry() {
    setFrameLoaded(false)
    setStatus('booking')
    setFrameKey(current => current + 1)
  }

  if (!unlocked) {
    if (variant === 'milestone') {
      return <span className="text-xs text-muted-foreground">Persoonlijk met je adviseur</span>
    }

    return (
      <section className="rounded-2xl border border-border bg-muted/50 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Lock size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground/60">Persoonlijk oriëntatiegesprek</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Vrijgespeeld zodra je alle 6 kernvideo&apos;s hebt voltooid.</p>
          </div>
        </div>
      </section>
    )
  }

  if (user?.call_booked && !open && variant !== 'sidebar') {
    const appointment = formatAppointment(user.call_start_at, user.call_timezone)

    if (variant === 'milestone') {
      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <CheckCircle2 size={14} className="shrink-0" />
          <span className="first-letter:uppercase">
            {appointment ? `${appointment.datePart} om ${appointment.timePart}` : 'Gesprek ingepland'}
          </span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-card-foreground">
        <CheckCircle2 size={20} className="shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Je oriëntatiegesprek is ingepland</p>
          {appointment ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground first-letter:uppercase">{appointment.datePart}</span>
              {' om '}
              <span className="font-semibold text-foreground">{appointment.timePart}</span>
              {' · bevestiging per e-mail'}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Je ontvangt de afspraakbevestiging per e-mail.</p>
          )}
        </div>
      </div>
    )
  }

  const unavailable = !isLoading && (error || !data?.available || !data.booking_url)
  const trigger = variant === 'sidebar' ? (
    <button
      type="button"
      onClick={() => handleOpenChange(true)}
      disabled={isLoading || unavailable}
      className="flex w-full items-center gap-2.5 rounded-full px-3 py-3 text-left text-sm font-medium text-foreground/65 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 sm:py-2"
    >
      {isLoading ? <LoaderCircle size={16} className="shrink-0 animate-spin opacity-60" /> : <CalendarDays size={16} className="shrink-0 opacity-60" />}
      <span className="flex-1">Strategy Meeting</span>
      {!isLoading && !unavailable ? <ArrowRight size={13} className="opacity-45" /> : null}
    </button>
  ) : variant === 'milestone' ? (
    <Button onClick={() => handleOpenChange(true)} disabled={isLoading || unavailable} size="sm" className="w-full rounded-lg text-xs font-bold">
      {isLoading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CalendarDays data-icon="inline-start" />}
      {isLoading ? 'Agenda laden' : unavailable ? 'Agenda niet beschikbaar' : 'Kies een moment'}
      {!isLoading && !unavailable && <ArrowRight data-icon="inline-end" />}
    </Button>
  ) : (
    <section className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Plan je persoonlijk oriëntatiegesprek</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Kies rechtstreeks een moment in de agenda{data?.owner_name ? ` van ${data.owner_name}` : ''}. Je blijft gewoon in Archer.
            </p>
          </div>
        </div>
        <Button onClick={() => handleOpenChange(true)} disabled={isLoading || unavailable} size="lg" className="rounded-full px-5">
          {isLoading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CalendarDays data-icon="inline-start" />}
          {isLoading ? 'Agenda laden' : unavailable ? 'Tijdelijk niet beschikbaar' : 'Kies een moment'}
          {!isLoading && !unavailable && <ArrowRight data-icon="inline-end" />}
        </Button>
      </div>
    </section>
  )

  if (!data?.booking_url) return trigger

  return (
    <>
      {trigger}
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-foreground/45 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <Dialog.Popup className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl transition duration-200 data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 sm:h-[min(860px,calc(100dvh-3rem))] sm:max-w-5xl sm:rounded-2xl">
              <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <Dialog.Title className="text-base font-bold text-balance sm:text-lg">Kies je moment</Dialog.Title>
                  <Dialog.Description className="mt-0.5 truncate text-sm text-muted-foreground">
                    {data.owner_name ? `Rechtstreeks in de agenda van ${data.owner_name}` : 'Rechtstreeks in de agenda van Archer Invest'}
                  </Dialog.Description>
                </div>
                <Dialog.Close className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Boekingsvenster sluiten">
                  <X size={18} />
                </Dialog.Close>
              </header>

              <div className="relative min-h-0 flex-1 bg-background">
                {status === 'booked' ? (
                  <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 size={28} />
                    </div>
                    <div className="flex max-w-md flex-col gap-2">
                      <h2 className="text-xl font-bold text-balance">Je oriëntatiegesprek staat ingepland</h2>
                      <p className="text-sm leading-6 text-muted-foreground">We hebben je boeking geregistreerd. HubSpot stuurt de afspraakbevestiging en alle praktische info per e-mail.</p>
                    </div>
                    <Dialog.Close className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      Terug naar mijn traject
                    </Dialog.Close>
                  </div>
                ) : status === 'error' ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <RotateCw size={22} />
                    </div>
                    <div className="flex max-w-sm flex-col gap-2">
                      <h2 className="text-lg font-bold">De agenda kon niet goed laden</h2>
                      <p className="text-sm leading-6 text-muted-foreground">Probeer de agenda opnieuw te laden. Je voortgang blijft gewoon bewaard.</p>
                    </div>
                    <Button onClick={retry} variant="outline">
                      <RotateCw data-icon="inline-start" />
                      Opnieuw proberen
                    </Button>
                  </div>
                ) : (
                  <>
                    {!frameLoaded && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background">
                        <LoaderCircle className="animate-spin text-primary" size={28} />
                        <p className="text-sm font-medium text-muted-foreground">Beschikbare momenten laden...</p>
                      </div>
                    )}
                    {status === 'saving' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm">
                        <LoaderCircle className="animate-spin text-primary" size={28} />
                        <p className="text-sm font-semibold">Je boeking wordt geregistreerd...</p>
                      </div>
                    )}
                    <iframe
                      key={frameKey}
                      src={getEmbedUrl(data.booking_url)}
                      title="Plan je persoonlijk oriëntatiegesprek"
                      className="h-full w-full border-0 bg-card"
                      onLoad={() => setFrameLoaded(true)}
                      onError={() => setStatus('error')}
                    />
                  </>
                )}
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
