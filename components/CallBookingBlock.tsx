'use client'

import useSWR from 'swr'
import { ArrowUpRight, CalendarDays, CheckCircle2, Lock } from 'lucide-react'
import { useApp } from '@/components/app-context'

interface BookingResponse {
  available: boolean
  owner_name?: string | null
}

interface CallBookingBlockProps {
  compact?: boolean
  unlocked: boolean
}

const fetcher = async (url: string): Promise<BookingResponse> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Boekingslink kon niet worden geladen')
  return response.json()
}

export default function CallBookingBlock({ compact = false, unlocked }: CallBookingBlockProps) {
  const { user } = useApp()
  const { data } = useSWR<BookingResponse>(unlocked ? '/api/call-booking' : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  if (!unlocked) {
    return (
      <section className={`rounded-2xl border border-border bg-muted/50 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Lock size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground/60">Persoonlijk adviesgesprek</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Vrijgespeeld zodra je alle 6 kernvideo&apos;s hebt voltooid.</p>
          </div>
        </div>
      </section>
    )
  }

  if (!data?.available) return null

  if (user?.call_booked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-card-foreground">
        <CheckCircle2 size={20} className="shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Je adviesgesprek is ingepland</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Je ontvangt de afspraakbevestiging per e-mail.</p>
        </div>
      </div>
    )
  }

  return (
    <section className={`rounded-2xl border border-primary/15 bg-primary/[0.04] ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Plan je persoonlijk adviesgesprek</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Je hebt het traject afgerond. Kies rechtstreeks een moment in de agenda{data.owner_name ? ` van ${data.owner_name}` : ''}.
            </p>
          </div>
        </div>
        <a
          href="/api/call-booking/click"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-85"
        >
          Plan een gesprek
          <ArrowUpRight size={16} />
        </a>
      </div>
    </section>
  )
}
