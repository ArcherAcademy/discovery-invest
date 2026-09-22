'use client'

import Link from 'next/link'
import { FileText, Lock, Play, Clock } from 'lucide-react'
import { useApp } from '@/components/app-context'
import PdfThumbnail from '@/components/PdfThumbnail'

// Accent colours per video slot (index 0–5)
const CORE_COLORS = ['#2500F5', '#2500F5', '#2500F5', '#2500F5', '#2500F5', '#2500F5']

const CORE_HIGHLIGHTS = [
  ['Waarom België richting onhoudbare schulden en vergrijzing gaat', 'Wat inflatie écht met je spaargeld doet'],
  ['Hoe je vermogen meestal piekt rond je pensioen en daarna sterk daalt', 'Het verschil tussen de creërende en de investerende fase'],
  ['Wat je gewogen gemiddeld rendement is en waarom dat cijfer telt', 'Waarom het cijfer dat je denkt te halen vaak lager uitvalt'],
  ['Hoe kosten, dividendstructuur en fondslocatie je nettorendement bepalen', 'Wanneer kern-, satelliet- en speculatieve ETF’s zinvol zijn'],
  ['Hoe je al je assets, privé en professioneel, in één dashboard zet', 'Hoe de app je GGR en levensprojectie doorrekent'],
  ['Hoe de vierdaagse masterclass en de Invest-app één systeem vormen', 'Met welk twaalfmaandenplan je nadien aan de slag gaat'],
]

function fmt(seconds: number) {
  const m = Math.ceil(seconds / 60)
  return `${m} min`
}

export default function TrajectPage() {
  const { videos, progress, coreCompleted, allCoreCompleted, investAvondGeclaimd } = useApp()
  const progressMap = new Map(progress.map(p => [p.video_id, p]))
  const bonusUnlocked = allCoreCompleted && investAvondGeclaimd
  const pct = Math.round((coreCompleted / 6) * 100)

  // Split live database videos into core and bonus
  const coreVideos = videos.filter(v => v.section === 'core')
  const bonusVideos = videos.filter(v => v.section === 'bonus')

  function getStatus(id: string) {
    const p = progressMap.get(id)
    if (!p || p.status === 'not_started') return 'not_started'
    if (p.status === 'in_progress') return 'in_progress'
    return 'completed'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#0d0f14' }}>Je Traject</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(13,15,20,0.5)' }}>
          Jouw 7-daagse gratis Invest-traject
        </p>
      </div>

      {/* Compact progress strip */}
      <div
        className="flex items-center gap-5 px-5 py-4 rounded-2xl border"
        style={{ background: '#ffffff', borderColor: '#e8ecf4' }}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(13,15,20,0.4)' }}>
              Cursusvoortgang
            </span>
            <span className="text-sm font-bold" style={{ color: '#2500F5' }}>{pct}% voltooid</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-all duration-500"
                style={{ background: i < coreCompleted ? '#2500F5' : '#e8ecf4' }}
              />
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xl font-bold" style={{ color: '#0d0f14' }}>{coreCompleted}</span>
          <span className="text-sm" style={{ color: 'rgba(13,15,20,0.4)' }}>/6</span>
          <p className="text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>video&apos;s</p>
        </div>
      </div>

      {/* Core videos — main block */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold" style={{ color: '#0d0f14' }}>De 6 kernvideo&apos;s</h2>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
          >
            {coreCompleted}/6 voltooid
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {coreVideos.map((video, i) => {
            const color = CORE_COLORS[i] ?? '#2500F5'
            const status = getStatus(video.id)
            const isCompleted = status === 'completed'
            const isInProgress = status === 'in_progress'
            // Video N (index i) is locked when video N-1 (index i-1) is not yet 'completed'.
            // Video 1 (i=0) is always available.
            const previousCompleted = i === 0 || progressMap.get(coreVideos[i - 1]?.id)?.status === 'completed'
            const isLocked = !previousCompleted
            const canPlay = !isLocked

            const card = (
              <div
                className="core-video-card relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200"
                style={{
                  background: '#ffffff',
                  borderColor: isCompleted ? '#2500F5' : isInProgress ? 'rgba(37,0,245,0.3)' : '#e8ecf4',
                  boxShadow: '0 1px 4px rgba(13,15,20,0.06)',
                  opacity: isLocked ? 0.55 : 1,
                  cursor: canPlay ? 'pointer' : 'default',
                }}
              >
                {/* Thumbnail */}
                <div className="relative h-48 overflow-hidden">
                  {/* Photo thumbnail — always visible, dimmed when locked */}
                  <img
                    src={
                      i === 0
                        ? '/video-1-thumbnail.png'
                        : i === 1
                          ? '/video-2-thumbnail.png'
                          : i === 2
                            ? '/video-3-thumbnail.png'
                            : i === 3
                              ? '/video-4-thumbnail.png'
                              : i === 4
                                ? '/video-5-thumbnail.png'
                                : i === 5
                                  ? '/video-6-thumbnail.png'
                                  : '/video-thumbnail.png'
                    }
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: isLocked ? 'brightness(0.45)' : isCompleted ? 'brightness(0.6)' : 'brightness(0.75)' }}
                  />

                  {/* Number badge */}
                  <span
                    className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10"
                    style={{ background: color, color: '#fff' }}
                  >
                    {video.order_no}
                  </span>

                  {/* Duration chip */}
                  <span
                    className="absolute top-2.5 right-2.5 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full z-10"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                  >
                    <Clock size={10} />
                    {fmt(video.duration_seconds ?? 0)}
                  </span>

                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    {isLocked ? (
                      <Lock size={24} color="rgba(255,255,255,0.7)" />
                    ) : !isCompleted ? (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-200"
                        style={{ background: color }}
                      >
                        <Play size={18} color="#fff" fill="#fff" />
                      </div>
                    ) : null}
                  </div>

                  {/* Progress bar */}
                  {isCompleted && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 z-10" style={{ background: color }} />
                  )}
                  {isInProgress && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 z-10" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: color,
                          width: `${progressMap.get(video.id)?.progress_pct ?? 0}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <p className="truncate text-sm font-semibold" style={{ color: '#0d0f14' }}>
                    {video.title}
                  </p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: isCompleted
                        ? 'rgba(37,0,245,0.1)'
                        : isInProgress
                          ? 'rgba(37,0,245,0.06)'
                          : '#f0f3fb',
                      color: isCompleted || isInProgress || canPlay ? '#2500F5' : 'rgba(13,15,20,0.4)',
                    }}
                  >
                    {isCompleted ? 'Voltooid' : isInProgress ? 'Verder kijken' : isLocked ? 'Vergrendeld' : 'Start nu →'}
                  </span>
                </div>

                {/* Desktop hover/focus detail — only this card changes. Touchscreens keep the thumbnail. */}
                <div className="core-video-details pointer-events-none absolute inset-0 z-20 hidden flex-col bg-card p-5 text-card-foreground opacity-0 transition-opacity duration-200 sm:flex">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {video.order_no}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmt(video.duration_seconds ?? 0)}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold tracking-tight">{video.title}</h3>
                  <ul className="mt-3 flex flex-1 flex-col gap-2 text-sm leading-5 text-muted-foreground">
                    {(CORE_HIGHLIGHTS[i] ?? [video.description]).filter(Boolean).map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="mt-4 inline-flex min-h-10 w-fit items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
                    {isCompleted ? 'Opnieuw bekijken' : isInProgress ? 'Verder kijken' : isLocked ? `Gaat open na video ${i}` : 'Start nu →'}
                  </span>
                </div>
              </div>
            )

            return canPlay ? (
              <Link
                key={video.id}
                href={`/video/${video.id}`}
                className="core-video-link block transition-transform duration-200 hover:-translate-y-0.5"
              >
                {card}
              </Link>
            ) : (
              <div
                key={video.id}
                title={`Kijk eerst video ${i} volledig af (80%+) om video ${i + 1} te ontgrendelen`}
              >
                {card}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bonus videos — subordinate, locked */}
      <section id="bonusmateriaal" className="scroll-mt-6">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold" style={{ color: '#0d0f14' }}>
              Jouw bonusmateriaal
            </h2>
            <p className="text-xs leading-5" style={{ color: 'rgba(13,15,20,0.5)' }}>
              Na alle 6 kernvideo&apos;s bekijk je eerst de korte Vermogensavond-video. Daarna wordt je bonusmateriaal vrijgegeven.
            </p>
          </div>
          {!bonusUnlocked && (
            <span className="flex shrink-0 items-center gap-1 text-xs" style={{ color: 'rgba(13,15,20,0.4)' }}>
              <Lock size={10} /> {allCoreCompleted ? 'Bekijk eerst de Vermogensavond' : 'Kijk eerst alle 6 kernvideo&apos;s'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {bonusVideos.map((video) => {
            const isPdf = video.content_type === 'pdf'
            return bonusUnlocked ? (
              <Link
                key={video.id}
                href={`/video/${video.id}`}
                className="group flex flex-col rounded-xl border overflow-hidden hover:-translate-y-0.5 transition-all duration-200"
                style={{ background: '#ffffff', borderColor: '#e8ecf4', boxShadow: '0 1px 4px rgba(13,15,20,0.06)' }}
              >
                {isPdf ? (
                  /* PDF thumbnail — first page rendered by pdf.js, same engine as the viewer */
                  <div className="relative h-28 overflow-hidden">
                    <PdfThumbnail pdfUrl={video.video_url} className="absolute inset-0" />
                    <span
                      className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded z-10"
                      style={{ background: 'rgba(37,0,245,0.25)', color: '#6b8cff' }}
                    >
                      PDF
                    </span>
                  </div>
                ) : (
                  <div className="relative h-28 overflow-hidden">
                    <img
                      src={
                        video.title.toLowerCase().includes('technische analyse')
                          ? '/bonus-technische-analyse-thumbnail.png'
                          : video.title.toLowerCase().includes('masterclass')
                            ? '/bonus-masterclass-thumbnail.png'
                            : '/video-thumbnail.png'
                      }
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover brightness-75"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: '#2500F5' }}
                      >
                        <Play size={12} color="#fff" fill="#fff" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="px-3 py-2.5">
                  <p className="text-xs font-semibold truncate" style={{ color: '#0d0f14' }}>{video.title}</p>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(13,15,20,0.4)' }}>
                    {isPdf ? <><FileText size={9} /> PDF-gids</> : <><Clock size={9} /> {fmt(video.duration_seconds)}</>}
                  </p>
                </div>
              </Link>
            ) : (
              <div
                key={video.id}
                className="flex flex-col rounded-xl border overflow-hidden"
                style={{ background: '#f8f9fc', borderColor: '#e8ecf4', opacity: 0.7 }}
              >
                {isPdf ? (
                  <div
                    className="relative h-28 flex items-center justify-center"
                    style={{ background: '#1a1f35' }}
                  >
                    <Lock size={16} color="rgba(255,255,255,0.35)" />
                  </div>
                ) : (
                  <div className="relative h-28 overflow-hidden">
                    <img
                      src={
                        video.title.toLowerCase().includes('technische analyse')
                          ? '/bonus-technische-analyse-thumbnail.png'
                          : video.title.toLowerCase().includes('masterclass')
                            ? '/bonus-masterclass-thumbnail.png'
                            : '/video-thumbnail.png'
                      }
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ filter: 'brightness(0.3) grayscale(0.5)' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock size={16} color="rgba(255,255,255,0.5)" />
                    </div>
                  </div>
                )}
                <div className="px-3 py-2.5">
                  <p className="text-xs font-semibold truncate" style={{ color: 'rgba(13,15,20,0.5)' }}>{video.title}</p>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(13,15,20,0.3)' }}>
                    {isPdf ? <><FileText size={9} /> PDF-gids</> : <><Clock size={9} /> {fmt(video.duration_seconds)}</>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
