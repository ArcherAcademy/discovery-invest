'use client'

import PlatformIntroModal from '@/components/PlatformIntroModal'
import { HomeJourneyShowcase } from '@/components/HomeJourneyShowcase'
import { HomeKpiCards } from '@/components/HomeKpiCards'
import { HomeParticipantExperiences } from '@/components/HomeParticipantExperiences'
import { VermogensavondCta } from '@/components/VermogensavondCta'
import { useApp } from '@/components/app-context'

const VIDEO_TITLES = ['De Why', 'De Levensloop', 'GGR', 'ETF', 'De Invest-app', 'De Oplossing']
const VIDEO_DURATIONS = [12, 18, 22, 25, 15, 20]

export default function HomePage() {
  const { user, videos, progress, coreCompleted } = useApp()

  const coreVideos = [...videos].filter(video => video.section === 'core').sort((a, b) => a.order_no - b.order_no)
  const bonusVideos = [...videos].filter(video => video.section === 'bonus').sort((a, b) => a.order_no - b.order_no)
  const isLoading = videos.length === 0
  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Investeerder'
  const videoProgressMap = new Map(progress.map(item => [item.video_id, item]))
  const accountAgeMs = user?.created_at ? Date.now() - new Date(user.created_at).getTime() : Infinity
  const isNewAccount = accountAgeMs >= 0 && accountAgeMs <= 7 * 24 * 60 * 60 * 1000

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
    durationSeconds: video.duration_seconds ?? (VIDEO_DURATIONS[index] || 0) * 60,
    contentType: video.content_type,
    progressPct: videoProgressMap.get(video.id)?.progress_pct ?? 0,
    status: getStatus(video.id),
    index,
    thumbnailUrl: index === 0 ? '/images/video-1-thumbnail.png' : `/video-${index + 1}-thumbnail.png`,
  }))

  const displayBonusVideos = bonusVideos.map((video, index) => ({
    id: video.id,
    title: video.title || 'Bonusmateriaal',
    durationSeconds: video.duration_seconds ?? 0,
    progressPct: videoProgressMap.get(video.id)?.progress_pct ?? 0,
    status: getStatus(video.id),
    index,
    thumbnailUrl: '/video-thumbnail.jpg',
  }))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PlatformIntroModal
        accountKey={user?.id ?? user?.email ?? null}
        isNewAccount={isNewAccount}
        firstVideoId={coreVideos[0]?.id ?? null}
      />

      <HomeJourneyShowcase
        firstName={firstName}
        videos={displayVideos}
        bonusVideos={displayBonusVideos}
        completedCount={coreCompleted}
        loading={isLoading}
      />

      <HomeParticipantExperiences />

      <HomeKpiCards />

      <VermogensavondCta />

    </div>
  )
}
