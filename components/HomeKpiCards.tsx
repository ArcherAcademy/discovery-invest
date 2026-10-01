'use client'

import { CalendarDays, Clock } from 'lucide-react'
import useSWR from 'swr'
import { useApp } from '@/components/app-context'
type MasterclassEditionResponse = {
  edition: {
    title: string
    startsAt: string
    filledPercentage: number
    availablePercentage: number
  }
}

async function fetchMasterclassEdition(url: string): Promise<MasterclassEditionResponse> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'include' })
  if (!response.ok) throw new Error(`Editiedata laden mislukt (${response.status})`)
  return response.json() as Promise<MasterclassEditionResponse>
}

function ProgressRing({ percentage }: { percentage: number }) {
  const size = 48
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const completed = (percentage / 100) * circumference

  return (
    <div className="relative shrink-0" aria-hidden="true">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} className="fill-none stroke-border" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none stroke-primary"
          strokeWidth={5}
          strokeDasharray={`${completed} ${circumference - completed}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">
        {percentage}%
      </span>
    </div>
  )
}

export function HomeKpiCards() {
  const { coreCompleted, videos, trialDaysLeft } = useApp()
  const { data } = useSWR<MasterclassEditionResponse>('/api/masterclass-editions', fetchMasterclassEdition, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 30_000,
  })

  const coreVideoCount = videos.filter(video => video.section === 'core').length || 6
  const progressPercentage = Math.min(100, Math.round((coreCompleted / coreVideoCount) * 100))
  const nextEdition = data?.edition ?? null
  const hasLimitedAccess = Number.isFinite(trialDaysLeft)
  const accessValue = hasLimitedAccess ? `${trialDaysLeft} ${trialDaysLeft === 1 ? 'dag' : 'dagen'}` : 'Onbeperkt'
  const accessDetail = hasLimitedAccess ? 'tot je toegang sluit' : 'voor jouw account'

  return (
    <section aria-label="Trajectstatus" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
      <article className="flex min-h-20 min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-card-foreground">
        <ProgressRing percentage={progressPercentage} />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Voortgang</p>
          <p className="text-xl font-bold leading-tight">{progressPercentage}%</p>
        </div>
      </article>

      <article className="flex min-h-20 min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-card-foreground">
        <Clock className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Toegang</p>
          <p className="truncate text-xl font-bold leading-tight">{accessValue}</p>
          <p className="truncate text-[11px] text-muted-foreground">{accessDetail}</p>
        </div>
      </article>

      <article className="flex min-h-20 min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-card-foreground">
        <CalendarDays className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Volgende editie</p>
          <p className="truncate text-xl font-bold leading-tight">
            {nextEdition ? `al ${nextEdition.filledPercentage}% vol` : '—'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {nextEdition?.title ?? 'Live editie niet beschikbaar'}
          </p>
        </div>
      </article>
    </section>
  )
}
