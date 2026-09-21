'use client'

import Link from 'next/link'
import { Play } from 'lucide-react'
import VimeoPlayer from '@/components/VimeoPlayer'
import { HomeTrajectOverview } from '@/components/HomeTrajectOverview'
import { VermogensavondCta } from '@/components/VermogensavondCta'
import { useApp } from '@/components/app-context'

const VIDEO_TITLES = ['De Why', 'De Levensloop', 'GGR', 'ETF', 'De Invest-app', 'De Oplossing']
const VIDEO_DURATIONS = [12, 18, 22, 25, 15, 20]

export default function HomePage() {
  const { user, videos, progress, coreCompleted, allCoreCompleted, refresh } = useApp()

  const coreVideos = [...videos].filter(video => video.section === 'core').sort((a, b) => a.order_no - b.order_no)
  const bonusVideos = [...videos].filter(video => video.section === 'bonus').sort((a, b) => a.order_no - b.order_no)
  const isLoading = videos.length === 0
  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Investeerder'
  const videoProgressMap = new Map(progress.map(item => [item.video_id, item]))

  function getStatus(videoId: string): 'not_started' | 'in_progress' | 'completed' {
    const status = videoProgressMap.get(videoId)?.status
    if (status === 'completed' || status === 'in_progress') return status
    return 'not_started'
  }

  const displayVideos = coreVideos.map((video, index) => ({
    id: video.id,
    title: video.title || VIDEO_TITLES[index] || 'Video',
    description: video.description,
    duration: Math.ceil((video.duration_seconds ?? 0) / 60) || VIDEO_DURATIONS[index] || 0,
    contentType: video.content_type,
    progressPct: videoProgressMap.get(video.id)?.progress_pct ?? 0,
    status: getStatus(video.id),
    index,
  }))

  const displayBonusVideos = bonusVideos.map(video => ({
    id: video.id,
    title: video.title,
    description: video.description,
    duration: Math.ceil((video.duration_seconds ?? 0) / 60),
    contentType: video.content_type,
    status: getStatus(video.id),
  }))

  const nextIncompleteCore = displayVideos.find(video => video.status !== 'completed') ?? null
  const nextIncompleteBonus = !nextIncompleteCore
    ? displayBonusVideos.find(video => video.status !== 'completed') ?? null
    : null

  const heroHref = isLoading
    ? '/traject'
    : nextIncompleteCore
      ? `/video/${nextIncompleteCore.id}`
      : nextIncompleteBonus
        ? `/video/${nextIncompleteBonus.id}`
        : '/traject'

  const heroLabel = isLoading
    ? 'Laden...'
    : nextIncompleteCore
      ? (coreCompleted === 0 ? 'Begin hier' : 'Verder kijken')
      : nextIncompleteBonus
        ? 'Bekijk je bonus'
        : 'Naar je traject'

  const featuredVideo = displayVideos.find(video => video.status === 'in_progress')
    ?? nextIncompleteCore
    ?? displayVideos.at(-1)
    ?? null
  const featuredNextVideo = featuredVideo ? displayVideos[featuredVideo.index + 1] ?? null : null

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <p className="text-sm font-semibold text-muted-foreground">
        Welkom terug, <span className="text-primary">{firstName}</span>
      </p>

      <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8">
        {featuredVideo ? (
          <>
            <header className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                Invest Discovery · Video {featuredVideo.index + 1} van {displayVideos.length}
              </p>
              <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {featuredVideo.title}
              </h1>
              {featuredVideo.description ? (
                <p className="max-w-4xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                  {featuredVideo.description}
                </p>
              ) : null}
            </header>

            {featuredVideo.contentType === 'video' && featuredVideo.id ? (
              <div className="overflow-hidden rounded-2xl bg-foreground shadow-lg">
                <VimeoPlayer
                  key={featuredVideo.id}
                  src={coreVideos[featuredVideo.index]?.video_url ?? ''}
                  videoDbId={featuredVideo.id}
                  completed={featuredVideo.status === 'completed'}
                  initialProgressPct={featuredVideo.progressPct}
                  nextVideoTitle={featuredNextVideo?.title ?? null}
                  nextContentType={featuredNextVideo?.contentType ?? null}
                  isLastVideo={featuredVideo.index === displayVideos.length - 1}
                  onCompleted={() => refresh()}
                  onUnlockNext={() => refresh()}
                />
              </div>
            ) : (
              <Link href={heroHref} className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-foreground text-background">
                <img
                  src={
                    featuredVideo.index === 0
                      ? '/video-1-thumbnail.png'
                      : featuredVideo.index === 1
                        ? '/video-2-thumbnail.png'
                        : featuredVideo.index === 2
                          ? '/video-3-thumbnail.png'
                          : featuredVideo.index === 3
                            ? '/video-4-thumbnail.png'
                            : featuredVideo.index === 4
                              ? '/video-5-thumbnail.png'
                              : '/video-thumbnail.png'
                  }
                  alt=""
                  className="absolute inset-0 size-full object-cover opacity-45 transition-transform duration-300 group-hover:scale-105"
                />
                <span className="relative flex size-16 items-center justify-center rounded-full bg-background text-foreground shadow-xl">
                  <Play size={24} fill="currentColor" />
                  <span className="sr-only">{heroLabel}</span>
                </span>
              </Link>
            )}
          </>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
            Je traject wordt geladen...
          </div>
        )}
      </section>

      <VermogensavondCta />

      <HomeTrajectOverview
        coreVideos={displayVideos}
        bonusVideos={displayBonusVideos}
        coreCompleted={coreCompleted}
        allCoreCompleted={allCoreCompleted}
        loading={isLoading}
      />
    </div>
  )
}
