'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, CheckCircle2, Lock,
  Play, Clock, Trophy, Zap, FileText,
} from 'lucide-react'

import { useApp } from '@/components/app-context'
import { t } from '@/lib/i18n'
import VimeoPlayer from '@/components/VimeoPlayer'
import InvestAvondUnlockModal from '@/components/InvestAvondUnlockModal'
import PdfItem from '@/components/PdfItem'


export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { videos, progress, coreCompleted, refresh, locale, loading } = useApp()
  const tr = t(locale)
  const router = useRouter()
  const [investAvondModalOpen, setInvestAvondModalOpen] = useState(false)

  const video = videos.find(v => v.id === id)
  const coreVideos = videos.filter(v => v.section === 'core')
  const bonusVideos = videos.filter(v => v.section === 'bonus')
  const allVideos = [...coreVideos, ...bonusVideos]
  const currentIndex = allVideos.findIndex(v => v.id === id)
  const coreIndex = coreVideos.findIndex(v => v.id === id)
  const isCoreVideo = coreIndex !== -1
  const videoNumber = isCoreVideo ? coreIndex + 1 : null
  const nextVideo = allVideos[currentIndex + 1] ?? null
  const prevVideo = allVideos[currentIndex - 1] ?? null
  // True only for video 6 itself — not derived from nextVideo, since bonus items
  // always follow core videos in allVideos and would otherwise mask this check.
  const isLastCoreVideo = isCoreVideo && coreIndex === coreVideos.length - 1

  const progressMap = new Map(progress.map(p => [p.video_id, p]))
  const overallPct = Math.round((coreCompleted / 6) * 100)
  const videosLeft = Math.max(0, 6 - coreCompleted)

  // Per-video unlock: video N is unlocked only when video N-1 is completed.
  // This derives from live progress data — re-evaluates after every refresh().
  function isVideoLocked(index: number): boolean {
    if (index === 0) return false // video 1 always available
    const previousVideo = coreVideos[index - 1]
    if (!previousVideo) return false
    return progressMap.get(previousVideo.id)?.status !== 'completed'
  }

  const currentCoreIndex = coreIndex
  const isCurrentLocked = isCoreVideo ? isVideoLocked(currentCoreIndex) : false

  // Server-side access guard: check via API on mount and after progress changes.
  // If the video is locked server-side, redirect to /traject.
  const [accessChecked, setAccessChecked] = useState(false)
  useEffect(() => {
    if (!id) return
    fetch(`/api/video-access?videoId=${id}`)
      .then(r => r.json())
      .then((data) => {
        if (!data.allowed) {
          router.replace('/traject')
        } else {
          setAccessChecked(true)
        }
      })
      .catch(() => setAccessChecked(true)) // network error: allow client-side check to handle
  }, [id, progress]) // re-check whenever progress changes (live unlock)

  const [completed, setCompleted] = useState(false)
  const [realDurationSeconds, setRealDurationSeconds] = useState<number | null>(null)
  // Cache real durations per video so sidebar shows correct times
  const [realDurations, setRealDurations] = useState<Record<string, number>>({})

  useEffect(() => {
    const existing = progress.find(p => p.video_id === id)
    setCompleted(existing?.status === 'completed')
  }, [progress, id])

  // Called by VimeoPlayer when 90% is reached — refresh progress from DB
  function handleCompleted() {
    setCompleted(true)
    refresh()
    if (isLastCoreVideo) setInvestAvondModalOpen(true)
  }

  if (!video) {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(13,15,20,0.12)', borderTopColor: '#2500F5' }}
          />
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: 'rgba(13,15,20,0.4)' }}>Video niet gevonden.</p>
      </div>
    )
  }

  const durationMin = Math.ceil((realDurationSeconds ?? video.duration_seconds ?? 0) / 60)

  return (
    <div className="max-w-7xl mx-auto px-0">
      {/* Back link */}
      <Link
        href="/traject"
        className="inline-flex items-center gap-1.5 text-sm mb-4 transition-colors"
        style={{ color: 'rgba(13,15,20,0.45)' }}
      >
        <ChevronLeft size={15} />
        Je Traject
      </Link>

      {/* Two-column layout — stacks on mobile, playlist sidebar moves below the player */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── LEFT: main column ── */}
        <div className="flex-1 min-w-0 w-full space-y-4">

          {/* Progress context bar */}
          <div
            className="flex items-center gap-4 px-4 py-2.5 rounded-2xl border"
            style={{ background: '#ffffff', borderColor: '#e8ecf4' }}
          >
            {videoNumber && (
              <span className="text-sm font-semibold shrink-0" style={{ color: '#0d0f14' }}>
                Video {videoNumber} van 6
              </span>
            )}
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e8ecf4' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ background: '#2500F5', width: `${overallPct}%` }}
              />
            </div>
            <span className="text-sm font-bold shrink-0" style={{ color: '#2500F5' }}>
              {overallPct}%
            </span>
          </div>

          {/* Video player or PDF viewer */}
          {video.content_type === 'pdf' ? (
            <PdfItem
              key={video.id}
              title={video.title}
              description={video.description}
              pdfUrl={video.video_url}
              videoDbId={video.id}
              onOpened={handleCompleted}
            />
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 4px 24px rgba(13,15,20,0.18), 0 1px 4px rgba(13,15,20,0.1)' }}
            >
              {video.video_url ? (
                <VimeoPlayer
                  key={video.id}
                  src={video.video_url}
                  videoDbId={video.id}
                  completed={completed}
                  nextVideoTitle={nextVideo?.title ?? null}
                  nextContentType={nextVideo?.content_type ?? null}
                  isLastVideo={isLastCoreVideo}
                  onCompleted={handleCompleted}
                  onUnlockNext={() => refresh()}
                  onAutoNext={() => {
                if (isLastCoreVideo) {
                  setInvestAvondModalOpen(true)
                } else if (nextVideo) {
                      router.push(`/video/${nextVideo.id}`)
                    }
                  }}
                  onRealDuration={(s) => {
                    setRealDurationSeconds(s)
                    setRealDurations(prev => ({ ...prev, [video.id]: s }))
                  }}
                />
              ) : (
                <div
                  className="relative flex flex-col items-center justify-center gap-4"
                  style={{ background: '#0d0f14', aspectRatio: '16/9' }}
                >
                  <img
                    src={
video.order_no === 1
                  ? '/images/video-1-thumbnail.png'
                        : video.order_no === 2
                          ? '/video-2-thumbnail.png'
                          : video.order_no === 3
                            ? '/video-3-thumbnail.png'
                            : video.order_no === 4
                              ? '/video-4-thumbnail.png'
                              : video.order_no === 5
                                ? '/video-5-thumbnail.png'
                                : video.order_no === 6
                                  ? '/video-6-thumbnail.png'
                                  : video.title.toLowerCase().includes('technische analyse')
                                    ? '/bonus-technische-analyse-thumbnail.png'
                                    : video.title.toLowerCase().includes('masterclass')
                                      ? '/bonus-masterclass-thumbnail.png'
                                      : '/video-thumbnail.png'
                    }
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover brightness-50"
                  />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95"
                      style={{ background: '#2500F5', boxShadow: '0 0 0 8px rgba(37,0,245,0.18)' }}
                    >
                      <Play size={24} color="#fff" fill="#fff" />
                    </div>
                    <p className="text-white font-semibold text-sm">{video.title}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Geen video URL ingesteld</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info card */}
          <div
            className="p-5 rounded-2xl border"
            style={{ background: '#ffffff', borderColor: '#e8ecf4', boxShadow: '0 1px 4px rgba(13,15,20,0.06)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold leading-snug text-balance" style={{ color: '#0d0f14' }}>
                  {video.title}
                </h1>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(13,15,20,0.55)' }}>
                  {video.description}
                </p>
              </div>
              {video.content_type !== 'pdf' && (
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
                  >
                    <Clock size={11} />
                    {durationMin} min
                  </span>
                  {completed && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}
                    >
                      <CheckCircle2 size={11} />
                      Voltooid
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Unlock motivation strip */}
          {video.content_type !== 'pdf' && !completed && videosLeft > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
              style={{ background: 'rgba(37,0,245,0.04)', borderColor: 'rgba(37,0,245,0.15)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(37,0,245,0.1)' }}
              >
                <Zap size={14} style={{ color: '#2500F5' }} />
              </div>
              <p className="text-sm" style={{ color: 'rgba(13,15,20,0.7)' }}>
                <span className="font-semibold" style={{ color: '#2500F5' }}>
                  Nog {videosLeft} video{videosLeft !== 1 ? "'s" : ''}
                </span>
                {' '}tot je bonusmateriaal vrijspeelt
              </p>
            </div>
          )}

          {video.content_type !== 'pdf' && completed && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
              style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(16,185,129,0.15)' }}
              >
                <CheckCircle2 size={15} style={{ color: '#059669' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#0d0f14' }}>
                {isLastCoreVideo
                  ? 'Alle 6 kernvideo\'s bekeken. Je bonusmateriaal is vrijgespeeld!'
                  : nextVideo && nextVideo.section === 'core'
                    ? `Goed gedaan! Ga door naar video ${coreVideos.findIndex(v => v.id === nextVideo.id) + 1}.`
                    : 'Goed gedaan! Je hebt deze video bekeken.'}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4 pb-6">
            {prevVideo ? (
              <Link
                href={`/video/${prevVideo.id}`}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border transition-all"
                style={{ borderColor: '#e8ecf4', color: 'rgba(13,15,20,0.6)', background: '#ffffff' }}
              >
                <ChevronLeft size={15} />
                <span className="truncate max-w-36">{prevVideo.title}</span>
              </Link>
            ) : <div />}

            {(() => {
              // Na de laatste kernvideo leidt de gebruiker rechtstreeks naar het bonusmateriaal.
              if (isLastCoreVideo) {
                if (!completed) {
                  return (
                    <div
                      className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full cursor-not-allowed select-none"
                      style={{ background: '#e8ecf4', color: 'rgba(13,15,20,0.3)' }}
                      title="Kijk eerst deze video volledig af (90%+) om verder te gaan"
                    >
                      <Lock size={13} />
                      Klaar
                    </div>
                  )
                }
                return (
                  <Link
                    href="/traject#bonusmateriaal"
                    className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
                    style={{ background: '#2500F5', color: '#fff', boxShadow: '0 4px 16px rgba(37,0,245,0.35)' }}
                  >
                    <Trophy size={14} />
                    Bekijk je bonus
                  </Link>
                )
              }

              if (!nextVideo) {
                // Laat de gebruiker na het laatste bonusitem terugkeren naar het trajectoverzicht.
                if (coreCompleted >= 6) {
                  return (
                    <Link
                      href="/traject"
                      className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
                      style={{ background: '#2500F5', color: '#fff', boxShadow: '0 4px 16px rgba(37,0,245,0.35)' }}
                    >
                      <Trophy size={14} />
                      Terug naar je traject
                    </Link>
                  )
                }
                return null
              }

              // Next is a core video: only clickable when current video is completed.
              // Next is bonus content: only clickable once all 6 core videos are completed.
              const nextCoreIndex = coreVideos.findIndex(v => v.id === nextVideo.id)
              const nextIsCore = nextCoreIndex !== -1
              const nextLocked = nextIsCore ? !completed : coreCompleted < 6
              if (nextLocked) {
                return (
                  <div
                    className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full cursor-not-allowed select-none"
                    style={{ background: '#e8ecf4', color: 'rgba(13,15,20,0.3)' }}
                    title="Kijk eerst deze video volledig af (90%+) om verder te gaan"
                  >
                    <Lock size={13} />
                    {tr.video.next}
                  </div>
                )
              }
              return (
                <Link
                  href={`/video/${nextVideo.id}`}
                  className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
                  style={{ background: '#2500F5', color: '#fff', boxShadow: '0 4px 16px rgba(37,0,245,0.35)' }}
                >
                  {tr.video.next}
                  <ChevronRight size={15} />
                </Link>
              )
            })()}
          </div>
        </div>

        {/* ── RIGHT: playlist sidebar — full width below player on mobile, fixed column on desktop ── */}
        <div
          className="w-full lg:w-72 shrink-0 rounded-2xl border overflow-hidden"
          style={{ background: '#ffffff', borderColor: '#e8ecf4', boxShadow: '0 1px 4px rgba(13,15,20,0.06)' }}
        >
          {/* Core videos header */}
          <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: '#e8ecf4' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(13,15,20,0.4)' }}>
                Kernvideo&apos;s
              </p>
              <span className="text-xs font-semibold" style={{ color: '#2500F5' }}>
                {coreCompleted}/6
              </span>
            </div>
          </div>

          {/* Core video rows */}
          <div>
            {coreVideos.map((v, i) => {
              const p = progressMap.get(v.id)
              const isDone = p?.status === 'completed'
              const isInProgress = p?.status === 'in_progress'
              const isCurrent = v.id === id
              // Video N is locked when video N-1 is not yet completed
              const isLocked = isVideoLocked(i)

              const row = (
                <div
                  className="flex items-center gap-3 px-4 py-3 transition-colors"
                  style={{
                    background: isCurrent
                      ? 'rgba(37,0,245,0.06)'
                      : 'transparent',
                    borderLeft: isCurrent ? '3px solid #2500F5' : '3px solid transparent',
                    opacity: isLocked ? 0.5 : 1,
                    cursor: isLocked ? 'default' : 'pointer',
                  }}
                >
                  {/* Status icon */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                      background: isDone
                        ? '#2500F5'
                        : isCurrent
                          ? 'rgba(37,0,245,0.12)'
                          : '#f0f3fb',
                      color: isDone ? '#fff' : isCurrent ? '#2500F5' : 'rgba(13,15,20,0.4)',
                    }}
                  >
                    {isDone
                      ? <CheckCircle2 size={14} color="#fff" />
                      : isLocked
                        ? <Lock size={11} style={{ color: 'rgba(13,15,20,0.35)' }} />
                        : <span>{i + 1}</span>
                    }
                  </div>

                  {/* Title + duration */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: isCurrent ? '#2500F5' : '#0d0f14' }}
                    >
                      {v.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock size={9} style={{ color: 'rgba(13,15,20,0.35)' }} />
                      <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>
                        {Math.ceil((realDurations[v.id] ?? v.duration_seconds ?? 0) / 60)} min
                      </span>
                      {isInProgress && (p?.progress_pct ?? 0) > 0 && (
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
                        >
                          {p?.progress_pct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )

              return isLocked ? (
                <div key={v.id} title={`Kijk eerst video ${i} volledig af om video ${i + 1} te ontgrendelen`}>{row}</div>
              ) : (
                <Link key={v.id} href={`/video/${v.id}`} className="block hover:bg-gray-50 transition-colors">
                  {row}
                </Link>
              )
            })}
          </div>

          {/* Bonus divider */}
          <div
            className="px-4 py-3 border-t border-b"
            style={{ borderColor: '#e8ecf4', background: coreCompleted >= 6 ? 'transparent' : '#fafbfd' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(13,15,20,0.4)' }}>
                Bonus
              </p>
              {coreCompleted < 6 ? (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(13,15,20,0.35)' }}>
                  <Lock size={10} />
                  6/6 vereist
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#059669' }}>
                  <Trophy size={10} />
                  Vrijgespeeld
                </span>
              )}
            </div>
          </div>

          {/* Bonus rows */}
          <div className="pb-2">
            {bonusVideos.map((v) => {
              const isUnlocked = coreCompleted >= 6
              const isCurrent = v.id === id
              const p = progressMap.get(v.id)
              const isDone = p?.status === 'completed'
              const isPdf = v.content_type === 'pdf'

              const row = (
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    background: isCurrent ? 'rgba(37,0,245,0.06)' : 'transparent',
                    borderLeft: isCurrent ? '3px solid #2500F5' : '3px solid transparent',
                    opacity: isUnlocked ? 1 : 0.45,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: isDone ? '#2500F5' : '#f0f3fb' }}
                  >
                    {isDone
                      ? <CheckCircle2 size={14} color="#fff" />
                      : isUnlocked
                        ? isPdf
                          ? <FileText size={11} color="#2500F5" />
                          : <Play size={11} color="#2500F5" fill="#2500F5" />
                        : <Lock size={11} style={{ color: 'rgba(13,15,20,0.35)' }} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: isCurrent ? '#2500F5' : '#0d0f14' }}>
                      {v.title}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isPdf ? (
                        <>
                          <FileText size={9} style={{ color: 'rgba(13,15,20,0.35)' }} />
                          <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>PDF-gids</span>
                        </>
                      ) : (
                        <>
                          <Clock size={9} style={{ color: 'rgba(13,15,20,0.35)' }} />
                          <span className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>
                            {Math.ceil((v.duration_seconds ?? 0) / 60)} min
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )

              return isUnlocked ? (
                <Link key={v.id} href={`/video/${v.id}`} className="block hover:bg-gray-50 transition-colors">
                  {row}
                </Link>
              ) : (
                <div key={v.id}>{row}</div>
              )
            })}
          </div>
        </div>
      </div>
      <InvestAvondUnlockModal
        open={investAvondModalOpen && isLastCoreVideo}
        onUnlocked={refresh}
        onClose={() => setInvestAvondModalOpen(false)}
      />
    </div>
  )
}
