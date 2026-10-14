'use client'

import Link from 'next/link'
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
  const size = 28
  const radius = (size - 5) / 2
  const circumference = 2 * Math.PI * radius
  const completed = (percentage / 100) * circumference

  return (
    <div className="relative shrink-0" aria-hidden="true">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} className="fill-none stroke-border" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-none stroke-primary"
          strokeWidth={3}
          strokeDasharray={`${completed} ${circumference - completed}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-primary">
        {percentage}
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
    <section aria-label="Trajectstatus" className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <h2 className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Jouw traject
      </h2>

      <div className="divide-y divide-border">
        <article className="flex min-w-0 items-center gap-2.5 px-3 py-2">
          <ProgressRing percentage={progressPercentage} />
          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">Voortgang</p>
            <p className="shrink-0 text-xs font-bold">{progressPercentage}%</p>
          </div>
        </article>

        <article className="flex min-w-0 items-center gap-2.5 px-3 py-2">
          <Clock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">Toegang</p>
            <p className="shrink-0 text-xs font-bold" title={accessDetail}>{accessValue}</p>
          </div>
        </article>

        <Link
          href="/masterclass"
          className="flex min-w-0 items-center gap-2.5 px-3 py-2 transition-colors hover:bg-primary/[0.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        >
          <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs text-muted-foreground">Volgende editie</p>
              <p className="shrink-0 text-xs font-bold">
                {nextEdition ? `${nextEdition.filledPercentage}% vol` : 'Laden'}
              </p>
            </div>
            <p className="truncate text-[10px] leading-4 text-muted-foreground">
              {nextEdition?.title ?? 'Actuele editie ophalen'}
            </p>
          </div>
        </Link>
      </div>
    </section>
  )
}
