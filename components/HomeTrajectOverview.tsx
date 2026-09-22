'use client'

import Link from 'next/link'
import { ArrowRight, Check, ChevronRight, Clock, Lock, Play } from 'lucide-react'
import PdfThumbnail from '@/components/PdfThumbnail'

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
  'Waarom je pensioen niet vanzelfsprekend is, en wat inflatie met je koopkracht doet.',
  'Waarom je vermogen daalt na je pensioen, en hoe je dat omdraait.',
  'Het ene getal dat bepaalt of je over 20 jaar rijker of armer bent.',
  'Waarom kosten op lange termijn duizenden euro’s verschil maken.',
  'Je volledige financiële leven op één scherm.',
  'Hoe een plan over tien tot vijfentwintig jaar er concreet uitziet.',
]

const CORE_THUMBNAILS = [
  '/images/video-1-thumbnail.png',
  '/video-2-thumbnail.png',
  '/video-3-thumbnail.png',
  '/video-4-thumbnail.png',
  '/video-5-thumbnail.png',
  '/video-6-thumbnail.png',
]

function formatDuration(minutes: number, contentType: string) {
  if (contentType === 'pdf') return 'PDF'
  return minutes > 0 ? `${minutes} min` : 'Video'
}

function getBonusThumbnail(video: TrajectItem) {
  const title = video.title.toLowerCase()

  if (title.includes('technische analyse')) return '/bonus-technische-analyse-thumbnail.png'
  if (title.includes('masterclass') || title.includes('binnenkijken') || video.duration === 15) {
    return '/bonus-masterclass-thumbnail.png'
  }

  return '/video-thumbnail.png'
}

function VideoThumbnail({
  src,
  title,
  completed = false,
}: {
  src: string
  title: string
  completed?: boolean
}) {
  return (
    <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border transition-all duration-300 group-hover:ring-primary-foreground/40 sm:w-32">
      <img
        src={src}
        alt={`Thumbnail van ${title}`}
        className="interactive-video-image size-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-primary/0 transition-colors duration-300 group-hover:bg-primary/35" />
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-lg">
          <Play size={14} fill="currentColor" />
        </span>
      </span>
      {completed ? (
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors group-hover:bg-primary-foreground group-hover:text-primary">
          <Check size={12} strokeWidth={3} />
        </span>
      ) : null}
    </div>
  )
}

export function HomeTrajectOverview({
  coreVideos,
  bonusVideos,
  coreCompleted,
  allCoreCompleted,
  loading,
}: HomeTrajectOverviewProps) {
  const activeCoreVideoIndex = coreVideos.findIndex(video => video.status !== 'completed')

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
            const isCompleted = video.status === 'completed'
            const isActive = index === activeCoreVideoIndex
            const isLocked = activeCoreVideoIndex !== -1 && index > activeCoreVideoIndex
            const description = video.description || CORE_DESCRIPTIONS[index] || ''

            const content = (
              <div className="flex min-h-24 items-center gap-4 px-5 py-4 sm:px-7">
                <VideoThumbnail
                  src={CORE_THUMBNAILS[index] || '/video-thumbnail.png'}
                  title={video.title}
                  completed={isCompleted}
                />

                <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[150px_1fr] sm:items-center sm:gap-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold transition-colors group-hover:text-primary-foreground">{video.title}</p>
                    <p className="text-xs text-muted-foreground transition-colors group-hover:text-primary-foreground/70">
                      {formatDuration(video.duration, video.contentType)}
                    </p>
                  </div>
                  <p className="hidden truncate text-sm text-muted-foreground transition-colors group-hover:text-primary-foreground/75 sm:block">
                    {description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center justify-end sm:min-w-28">
                  {isActive ? (
                    <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors group-hover:bg-primary-foreground group-hover:text-primary">
                      Start nu
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  ) : isLocked ? (
                    <Lock size={17} className="text-muted-foreground" aria-label="Vergrendeld" />
                  ) : (
                    <ChevronRight size={20} className="text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary-foreground" aria-hidden="true" />
                  )}
                </div>
              </div>
            )

            return isLocked ? (
              <div key={video.id} aria-disabled="true" className="opacity-70">{content}</div>
            ) : (
              <Link
                key={video.id}
                href={`/video/${video.id}`}
                className="interactive-video-row group block transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              >
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
              const isPdf = video.contentType === 'pdf'
              const item = (
                <div className="flex min-h-24 items-center gap-4 px-5 py-4 sm:px-7">
                  {isPdf ? (
                    <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border sm:w-32">
                      <PdfThumbnail
                        pdfUrl="/bonus/de-vermogenskloof.pdf"
                        className="absolute inset-0"
                      />
                    </div>
                  ) : (
                    <VideoThumbnail
                      src={getBonusThumbnail(video)}
                      title={video.title}
                      completed={video.status === 'completed'}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold transition-colors group-hover:text-primary-foreground">{video.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-primary-foreground/70">
                      {!isPdf ? <Clock size={11} /> : null}
                      {formatDuration(video.duration, video.contentType)}
                    </p>
                  </div>
                  {allCoreCompleted ? (
                    <ChevronRight size={20} className="text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary-foreground" />
                  ) : (
                    <Lock size={16} className="text-muted-foreground" aria-label="Vergrendeld" />
                  )}
                </div>
              )

              return allCoreCompleted ? (
                <Link
                  key={video.id}
                  href={`/video/${video.id}`}
                  className="interactive-video-row group block transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                >
                  {item}
                </Link>
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
