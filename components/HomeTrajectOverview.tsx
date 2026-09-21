'use client'

import Link from 'next/link'
import { ArrowRight, Check, ChevronRight, Clock, FileText, Lock, Play } from 'lucide-react'

interface TrajectItem {
  id: string
  title: string
  description?: string | null
  duration: number
  contentType: string
  status: 'not_started' | 'in_progress' | 'completed'
}

interface HomeTrajectOverviewProps {
  coreVideos: TrajectItem[]
  bonusVideos: TrajectItem[]
  coreCompleted: number
  allCoreCompleted: boolean
  loading: boolean
}

const CORE_DESCRIPTIONS = [
  'Waarom beleggen geen keuze meer is maar een verdediging.',
  'De drie fases van vermogen, en in welke jij zit.',
  'Het enige getal dat telt als je rendementen vergelijkt.',
  'Waarom kosten op lange termijn duizenden euro’s verschil maken.',
  'Je volledige financiële leven op één scherm.',
  'Hoe een plan over tien tot vijfentwintig jaar er concreet uitziet.',
]

function formatDuration(minutes: number, contentType: string) {
  if (contentType === 'pdf') return 'PDF'
  return minutes > 0 ? `${minutes} min` : 'Video'
}

export function HomeTrajectOverview({
  coreVideos,
  bonusVideos,
  coreCompleted,
  allCoreCompleted,
  loading,
}: HomeTrajectOverviewProps) {
  return (
    <div className="flex flex-col gap-7">
      <section className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
          <h2 className="text-xl font-bold tracking-tight">Je traject</h2>
          <p className="shrink-0 text-sm text-muted-foreground">{coreCompleted} van {coreVideos.length || 6} bekeken</p>
        </header>

        <div className="divide-y divide-border">
          {loading ? (
            <p className="px-5 py-8 text-sm text-muted-foreground sm:px-7">Je traject wordt geladen...</p>
          ) : null}

          {coreVideos.map((video, index) => {
            const previousCompleted = index === 0 || coreVideos[index - 1]?.status === 'completed'
            const isLocked = !previousCompleted
            const isCompleted = video.status === 'completed'
            const isActive = !isLocked && !isCompleted
            const description = video.description || CORE_DESCRIPTIONS[index] || ''

            const content = (
              <div className="flex min-h-20 items-center gap-4 px-5 py-4 sm:px-7">
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isCompleted || isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {isCompleted ? <Check size={15} strokeWidth={3} /> : index + 1}
                </div>

                <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{video.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(video.duration, video.contentType)}</p>
                  </div>
                  <p className="hidden truncate text-sm text-muted-foreground sm:block">{description}</p>
                </div>

                <div className="flex shrink-0 items-center justify-end sm:min-w-28">
                  {isActive ? (
                    <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
                      {video.status === 'in_progress' ? 'Ga verder' : 'Start nu'}
                      <ArrowRight size={15} />
                    </span>
                  ) : isLocked ? (
                    <Lock size={17} className="text-muted-foreground" aria-label="Vergrendeld" />
                  ) : (
                    <ChevronRight size={18} className="text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
              </div>
            )

            return isLocked ? (
              <div key={video.id} aria-disabled="true" className="opacity-70">{content}</div>
            ) : (
              <Link key={video.id} href={`/video/${video.id}`} className="block transition-colors hover:bg-muted/50">
                {content}
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="bonus-title" className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Je bonusmateriaal · gaat open na video 6
        </p>

        <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
            <h2 id="bonus-title" className="text-lg font-bold">Bonusmateriaal</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              {allCoreCompleted ? <Check size={13} /> : <Lock size={13} />}
              {allCoreCompleted ? 'Vrijgespeeld' : 'Bonus content'}
            </span>
          </header>

          <div className="divide-y divide-border">
            {bonusVideos.length === 0 && !loading ? (
              <p className="px-5 py-7 text-sm text-muted-foreground sm:px-7">Bonusmateriaal wordt binnenkort toegevoegd.</p>
            ) : null}

            {bonusVideos.map((video) => {
              const item = (
                <div className="flex min-h-16 items-center gap-4 px-5 py-4 sm:px-7">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${allCoreCompleted ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {allCoreCompleted ? (video.contentType === 'pdf' ? <FileText size={15} /> : <Play size={14} fill="currentColor" />) : <Lock size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{video.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {video.contentType !== 'pdf' ? <Clock size={11} /> : null}
                      {formatDuration(video.duration, video.contentType)}
                    </p>
                  </div>
                  {allCoreCompleted ? <ChevronRight size={18} className="text-muted-foreground" /> : <Lock size={16} className="text-muted-foreground" aria-label="Vergrendeld" />}
                </div>
              )

              return allCoreCompleted ? (
                <Link key={video.id} href={`/video/${video.id}`} className="block transition-colors hover:bg-muted/50">{item}</Link>
              ) : (
                <div key={video.id} aria-disabled="true" className="opacity-70">{item}</div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
