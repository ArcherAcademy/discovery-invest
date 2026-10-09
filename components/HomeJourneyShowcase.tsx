'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check, CircleCheck, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface HomeJourneyVideo {
  id: string
  title: string
  durationSeconds: number
  progressPct: number
  status: 'not_started' | 'in_progress' | 'completed'
  index: number
  thumbnailUrl: string
}

interface HomeJourneyShowcaseProps {
  firstName: string
  videos: HomeJourneyVideo[]
  bonusVideos: HomeJourneyVideo[]
  completedCount: number
  loading: boolean
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function HomeJourneyShowcase({
  firstName,
  videos,
  bonusVideos,
  completedCount,
  loading,
}: HomeJourneyShowcaseProps) {
  const isCompleted = videos.length > 0 && completedCount >= videos.length
  const activeVideo = videos.find(video => video.status === 'in_progress')
    ?? videos.find(video => video.status !== 'completed')
    ?? videos.at(-1)
    ?? null
  const activeBonus = bonusVideos.find(video => video.status === 'in_progress')
    ?? bonusVideos.find(video => video.status !== 'completed')
    ?? bonusVideos[0]
    ?? null
  const isShowingBonus = isCompleted && activeBonus !== null
  const heroVideo = isShowingBonus ? activeBonus : activeVideo
  const heroHref = heroVideo ? `/video/${heroVideo.id}` : '/traject'
  const primaryHref = isCompleted ? '/masterclass' : heroHref
  const primaryLabel = isCompleted ? 'Schrijf je in' : completedCount === 0 ? 'Start de discovery' : 'Ga verder met je discovery'
  const heroTitle = isShowingBonus
    ? `Je bonusmateriaal staat voor je klaar, ${firstName}.`
    : isCompleted
      ? `Je hebt de volledige reeks gezien, ${firstName}.`
      : completedCount === 0
        ? `Je discovery start hier, ${firstName}.`
        : `Goed bezig, ${firstName}. Je bent al goed op weg.`
  const heroSubtitle = isShowingBonus
    ? `Bekijk nu ${activeBonus.title}.`
    : isCompleted
      ? 'Je hebt de volledige discovery afgerond.'
      : completedCount === 0
        ? 'Zes korte video’s geven je zicht op een doordachte vermogensaanpak.'
        : `Je hebt ${completedCount} van de ${videos.length || 6} video’s bekeken.`

  if (loading || !heroVideo) {
    return (
      <section className="flex min-h-96 items-center justify-center rounded-3xl bg-card text-sm text-muted-foreground shadow-sm">
        Je traject wordt geladen...
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="relative min-h-[430px] overflow-hidden rounded-3xl bg-foreground text-background shadow-sm sm:min-h-[460px]">
        <Image
          src={heroVideo.thumbnailUrl}
          alt={`Videobeeld van ${heroVideo.title}`}
          fill
          priority
          sizes="(min-width: 1024px) 1100px, 100vw"
          className="object-cover object-center sm:object-[64%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,18,0.99)_0%,rgba(7,8,18,0.96)_31%,rgba(7,8,18,0.88)_49%,rgba(7,8,18,0.22)_67%,rgba(7,8,18,0.18)_100%)]" />
        <div className="relative flex min-h-[430px] flex-col p-6 pb-20 sm:min-h-[460px] sm:p-9">
          <div className="flex w-fit items-center gap-2 rounded-full bg-background/15 px-3 py-2 text-xs font-semibold text-background backdrop-blur-md">
            <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-primary-foreground">
              {isCompleted ? <Check className="size-3" strokeWidth={3} /> : <Play className="ml-px size-2.5" fill="currentColor" />}
            </span>
            <span>{isShowingBonus ? 'Bonusmateriaal' : isCompleted ? 'Discovery afgerond' : 'Invest Discovery'}</span>
            <span aria-hidden="true" className="text-background/45">·</span>
            <span>{completedCount} van {videos.length || 6}</span>
          </div>

          <div className="mt-7 max-w-[31rem]">
            <h1 className="text-balance text-3xl font-bold leading-[1.04] tracking-[-0.04em] text-background sm:text-4xl lg:text-[2.7rem]">
              {heroTitle}
            </h1>
            <p className="mt-4 text-pretty text-sm leading-6 text-background/70 sm:text-base">
              {heroSubtitle}
            </p>
          </div>

          <div className="mt-auto flex">
            <Link
              href={primaryHref}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-background px-5 text-sm font-bold text-primary shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            >
              {primaryLabel}
            </Link>
          </div>
        </div>

        <Link
          href={heroHref}
          className="absolute bottom-5 right-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-foreground/70 px-3 text-xs font-semibold text-background backdrop-blur-md transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
        >
          <Play className="size-3" fill="currentColor" />
          <span>{isShowingBonus ? 'Bekijk bonus' : isCompleted ? 'Bekijk opnieuw' : 'Bekijk video'}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDuration(heroVideo.durationSeconds)}</span>
        </Link>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card p-5 text-card-foreground shadow-sm sm:p-6">
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">Je traject</h2>
          <p className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
            {isCompleted ? <CircleCheck className="size-4 fill-emerald-500 text-emerald-500 [&_path:last-child]:text-primary-foreground" /> : null}
            {completedCount} van {videos.length || 6} bekeken
          </p>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {videos.map(video => {
            const isVideoCompleted = video.status === 'completed'
            const isActive = video.id === activeVideo?.id

            return (
              <Link
                key={video.id}
                href={`/video/${video.id}`}
                className="group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className={cn(
                  'relative aspect-[1.75] overflow-hidden rounded-xl bg-muted ring-1 ring-border transition-transform group-hover:-translate-y-0.5',
                  isActive && !isVideoCompleted && 'ring-2 ring-primary',
                )}>
                  <Image
                    src={video.thumbnailUrl}
                    alt={`Miniatuur van ${video.title}`}
                    fill
                    sizes="(min-width: 1024px) 160px, (min-width: 640px) 30vw, 45vw"
                    className="object-cover"
                  />
                  {isVideoCompleted ? (
                    <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : video.progressPct > 0 ? (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-background/35">
                      <span className="block h-full bg-primary" style={{ width: `${Math.min(video.progressPct, 100)}%` }} />
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-xs font-bold sm:text-[13px]">
                  <span className="mr-1.5 text-primary">{String(video.index + 1).padStart(2, '0')}</span>
                  {video.title}
                </p>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
