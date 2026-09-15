'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Play, ChevronRight, CheckCircle2, GraduationCap, CalendarDays, Pause, Volume2, VolumeX, Clock, Zap, Lock } from 'lucide-react'
import CallBookingBlock from '@/components/CallBookingBlock'
import { useApp } from '@/components/app-context'
import { t } from '@/lib/i18n'

const VIDEO_TITLES = ['De Why', 'De Levensloop', 'GGR', 'ETF', 'De Invest-app', 'De Oplossing']
const VIDEO_DURATIONS = [12, 18, 22, 25, 15, 20]
const VIDEO_COLORS = ['#2500F5', '#4a1fff', '#6b3fff', '#8b5fff', '#a87fff', '#c8a0ff']

function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e8ecf4" strokeWidth={5} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#2500F5" strokeWidth={5} fill="none"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function HomePage() {
  const { user, videos, progress, coreCompleted, allCoreCompleted, locale, trialDaysLeft } = useApp()
  const tr = t(locale)

  // Real DB videos, sorted by order_no so display order always matches actual course order.
  const coreVideos = [...videos].filter(v => v.section === 'core').sort((a, b) => a.order_no - b.order_no)
  const bonusVideos = [...videos].filter(v => v.section === 'bonus').sort((a, b) => a.order_no - b.order_no)
  const isLoading = videos.length === 0

  const progressPct = Math.round((coreCompleted / 6) * 100)
  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Investeerder'
  const videoProgressMap = new Map(progress.map(p => [p.video_id, p]))

  function getStatus(videoId: string) {
    const p = videoProgressMap.get(videoId)
    if (!p) return 'not_started'
    return p.status
  }

  // Display copy (title/duration/color) may fall back to friendly placeholders while data
  // loads, but the id is ALWAYS the real database id — never an invented/fallback id, so
  // every link always resolves to a real, existing video.
  const displayVideos = coreVideos.map((live, i) => ({
    id: live.id,
    title: live.title || VIDEO_TITLES[i] || live.title,
    duration: Math.ceil((live.duration_seconds ?? 0) / 60) || VIDEO_DURATIONS[i] || 0,
    color: VIDEO_COLORS[i] ?? VIDEO_COLORS[VIDEO_COLORS.length - 1],
    status: getStatus(live.id),
    index: i,
  }))

  // The next unfinished core video, in real course order.
  const nextIncompleteCore = displayVideos.find(v => v.status !== 'completed') ?? null
  // All core videos done: look for the next unfinished bonus item instead of looping back.
  const nextIncompleteBonus = !nextIncompleteCore
    ? bonusVideos.find(v => getStatus(v.id) !== 'completed') ?? null
    : null

  // Where "Begin hier" / "Verder kijken" sends the user. Every branch resolves to a route
  // that is guaranteed to exist — never a made-up id, never a dead click.
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

  const videoRef = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPaused(false) }
    else { v.pause(); setPaused(true) }
  }
  function toggleMute() {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  // Show: last completed, current/next (in-progress or first not started), and the one after
  const activeIndex = displayVideos.findIndex(v => v.status === 'in_progress')
  const nextIndex = activeIndex >= 0
    ? activeIndex
    : displayVideos.findIndex(v => v.status === 'not_started')
  const focusIndex = nextIndex >= 0 ? nextIndex : displayVideos.length - 1
  const contextVideos = [
    displayVideos[focusIndex - 1],
    displayVideos[focusIndex],
    displayVideos[focusIndex + 1],
  ].filter(Boolean)

  return (
    <>

    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden aspect-[4/5] sm:aspect-[16/6]">
        {/* Full-bleed video */}
        <video
          ref={videoRef}
          src="/hero-intro.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Dark gradient overlay — stronger at the bottom so #2500F5 stays legible */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(5,5,15,0.92) 0%, rgba(5,5,15,0.55) 40%, rgba(5,5,15,0.1) 100%)' }} />

        {/* Bottom-left: text + CTA */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-7 py-5 sm:py-6 sm:max-w-lg sm:right-auto">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase mb-2" style={{ color: '#2500F5' }}>
            INVEST DISCOVERY
          </p>
          <h1 className="text-2xl sm:text-[1.75rem] font-bold text-white leading-tight tracking-tight text-balance">
            Welkom, <span style={{ color: '#2500F5' }}>{firstName}.</span>
          </h1>
          <p className="text-sm mt-1 mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Jouw 7-daagse gratis Invest-traject
          </p>
          <Link
            href={heroHref}
            className="inline-flex items-center gap-2.5 px-5 py-3 sm:py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <Play size={14} fill="white" />
            {heroLabel}
          </Link>
        </div>

        {/* Top-right on mobile / bottom-right on desktop: pause + mute controls */}
        <div className="absolute top-3 right-3 sm:top-auto sm:bottom-5 sm:right-5 flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
            aria-label={paused ? 'Afspelen' : 'Pauzeren'}
          >
            {paused ? <Play size={13} fill="white" color="white" /> : <Pause size={13} fill="white" color="white" />}
          </button>
          <button
            onClick={toggleMute}
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
            aria-label={muted ? 'Geluid aan' : 'Dempen'}
          >
            {muted ? <VolumeX size={13} color="white" /> : <Volume2 size={13} color="white" />}
          </button>
        </div>
      </div>

      {/* ── STATS STRIP ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {[
          { label: 'Voortgang', value: `${progressPct}%`, ring: true },
          { label: 'Gekeken', value: `${coreCompleted}/6`, sub: 'kernvideo\'s' },
          {
            label: 'Traject loopt af',
            value: Number.isFinite(trialDaysLeft) ? `${trialDaysLeft}` : '∞',
            sub: Number.isFinite(trialDaysLeft) ? (trialDaysLeft === 1 ? 'dag resterend' : 'dagen resterend') : 'onbeperkte toegang',
          },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border px-4 py-3.5 flex items-center gap-3 min-w-0"
            style={{ background: '#fff', borderColor: '#e8ecf4' }}>
            {stat.ring && (
              <div className="relative shrink-0">
                <ProgressRing pct={progressPct} size={48} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold" style={{ color: '#2500F5' }}>{progressPct}%</span>
                </div>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-widest uppercase truncate" style={{ color: 'rgba(13,15,20,0.4)' }}>{stat.label}</p>
              <p className="text-xl font-bold leading-tight" style={{ color: '#0d0f14' }}>{stat.value}</p>
              {stat.sub && <p className="text-[11px] truncate" style={{ color: 'rgba(13,15,20,0.4)' }}>{stat.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN 2-COL GRID ─────────────────����──���────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* LEFT COLUMN */}
        <div className="space-y-5">

          {/* VRIJSPELEN LADDER */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: '#fff', borderColor: '#e8ecf4', boxShadow: '0 1px 3px rgba(13,15,20,0.06), 0 4px 16px rgba(37,0,245,0.05)' }}>
            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#f0f3fb' }}>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase mb-0.5" style={{ color: '#2500F5' }}>
                VRIJSPELEN & ONTGRENDELEN
              </p>
              <p className="text-xs" style={{ color: 'rgba(13,15,20,0.45)' }}>
                Kijk alle 6 kernvideo&apos;s en speel je bonus + persoonlijk adviesgesprek vrij
              </p>
            </div>

            {/* Milestone row */}
            <div className="px-5 py-5">
              <div className="flex flex-col sm:flex-row items-stretch gap-0">

                {/* Step 1 — 6 kernvideo's */}
                <div className="flex-1 sm:flex-1">
                  <div
                    className="rounded-xl p-4 border-2 transition-all"
                    style={{
                      background: coreCompleted > 0 ? 'rgba(37,0,245,0.04)' : '#fafbff',
                      borderColor: coreCompleted > 0 ? '#2500F5' : '#e8ecf4',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: coreCompleted >= 6 ? '#2500F5' : coreCompleted > 0 ? 'rgba(37,0,245,0.15)' : '#f0f3fb', color: coreCompleted >= 6 ? '#fff' : '#2500F5' }}>
                        {coreCompleted >= 6 ? <CheckCircle2 size={14} /> : '1'}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: '#0d0f14' }}>6 kernvideo&apos;s</span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#f0f3fb' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(coreCompleted / 6) * 100}%`, background: '#2500F5' }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: 'rgba(13,15,20,0.4)' }}>
                        {coreCompleted}/6 bekeken
                      </span>
                      <span className="text-lg font-bold tabular-nums" style={{ color: coreCompleted >= 6 ? '#2500F5' : '#0d0f14' }}>
                        {coreCompleted}/6
                      </span>
                    </div>
                  </div>
                </div>

                {/* Connector */}
                <div className="flex sm:items-center justify-center py-1.5 sm:py-0 sm:px-2 shrink-0">
                  <div className="flex sm:flex-col items-center gap-1">
                    <div className="w-px h-4 sm:w-6 sm:h-px" style={{ background: allCoreCompleted ? '#2500F5' : '#e8ecf4' }} />
                    <ChevronRight size={12} className="rotate-90 sm:rotate-0" style={{ color: allCoreCompleted ? '#2500F5' : '#c8d0e0' }} />
                  </div>
                </div>

                {/* Step 2 — bonusmateriaal */}
                <div className="flex-1">
                  <div
                    className="rounded-xl p-4 border-2 transition-all relative overflow-hidden"
                    style={{
                      background: allCoreCompleted ? 'rgba(37,0,245,0.04)' : '#fafbff',
                      borderColor: allCoreCompleted ? '#2500F5' : '#e8ecf4',
                    }}
                  >
                    {!allCoreCompleted && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{ background: 'rgba(245,248,255,0.7)', backdropFilter: 'blur(1px)', zIndex: 1 }}>
                        <div className="flex flex-col items-center gap-1">
                          <Lock size={16} style={{ color: 'rgba(13,15,20,0.25)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(13,15,20,0.3)' }}>Vrijspelen bij 6/6</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: allCoreCompleted ? '#2500F5' : '#f0f3fb', color: allCoreCompleted ? '#fff' : 'rgba(13,15,20,0.3)' }}>
                        {allCoreCompleted ? <CheckCircle2 size={14} /> : '2'}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: allCoreCompleted ? '#0d0f14' : 'rgba(13,15,20,0.35)' }}>
                        Bonusmateriaal
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full mb-2" style={{ background: allCoreCompleted ? '#2500F5' : '#f0f3fb' }} />
                    <span className="text-[11px]" style={{ color: allCoreCompleted ? '#2500F5' : 'rgba(13,15,20,0.3)' }}>
                      {allCoreCompleted ? 'Vrijgespeeld!' : '1 video + 1 document'}
                    </span>
                  </div>
                </div>

                {/* Connector */}
                <div className="flex sm:items-center justify-center py-1.5 sm:py-0 sm:px-2 shrink-0">
                  <div className="flex sm:flex-col items-center gap-1">
                    <div className="w-px h-4 sm:w-6 sm:h-px" style={{ background: '#e8ecf4' }} />
                    <ChevronRight size={12} className="rotate-90 sm:rotate-0" style={{ color: '#c8d0e0' }} />
                  </div>
                </div>

                {/* Step 3 — persoonlijk adviesgesprek */}
                <div className="flex-1">
                  <div
                    className="rounded-xl p-4 border-2 relative overflow-hidden"
                    style={{
                      background: allCoreCompleted ? 'rgba(37,0,245,0.04)' : '#fafbff',
                      borderColor: allCoreCompleted ? '#2500F5' : '#e8ecf4',
                    }}
                  >
                    {!allCoreCompleted && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{ background: 'rgba(245,248,255,0.7)', backdropFilter: 'blur(1px)', zIndex: 1 }}>
                        <div className="flex flex-col items-center gap-1">
                          <Lock size={16} style={{ color: 'rgba(13,15,20,0.25)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(13,15,20,0.3)' }}>Vrijgespeeld bij 6/6</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: allCoreCompleted ? '#2500F5' : '#f0f3fb', color: allCoreCompleted ? '#fff' : 'rgba(13,15,20,0.3)' }}>
                        {allCoreCompleted ? <CalendarDays size={14} /> : '3'}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: allCoreCompleted ? '#0d0f14' : 'rgba(13,15,20,0.3)' }}>Adviesgesprek</span>
                    </div>
                    <div className="h-1.5 rounded-full mb-3" style={{ background: allCoreCompleted ? '#2500F5' : '#f0f3fb' }} />
                    <CallBookingBlock unlocked={allCoreCompleted} variant="milestone" />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* VIDEO GRID */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ background: '#fff', borderColor: '#e8ecf4' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#f0f3fb' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#0d0f14' }}>Je Invest-traject</h2>
              <Link href="/traject" className="text-xs font-semibold" style={{ color: '#2500F5' }}>
                Alle video&apos;s
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: '#f0f3fb' }}>
              {isLoading && (
                <div className="px-5 py-6 text-sm" style={{ color: 'rgba(13,15,20,0.4)' }}>
                  Je traject wordt geladen...
                </div>
              )}
              {contextVideos.map((video) => {
                const isDone = video.status === 'completed'
                const isActive = video.status === 'in_progress'
                const isNext = !isDone && !isActive && video.index === focusIndex
                return (
                  <Link
                    key={video.id}
                    href={`/video/${video.id}`}
                    className="group flex items-center gap-4 px-5 py-4 transition-all hover:bg-[#fafbff]"
                  >
                    {/* Thumbnail */}
                    <div className="relative rounded-xl overflow-hidden shrink-0" style={{ width: 80, height: 56 }}>
                      <img
                        src="/video-thumbnail.png"
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        style={{ filter: isDone ? 'brightness(0.55)' : 'brightness(0.7)' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {isDone
                          ? <CheckCircle2 size={18} color="white" strokeWidth={2} />
                          : <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: video.color }}>
                              <Play size={11} fill="white" color="white" />
                            </div>
                        }
                      </div>
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'rgba(255,255,255,0.2)' }}>
                          <div className="h-full w-1/3 rounded-full" style={{ background: '#2500F5' }} />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold" style={{ color: 'rgba(13,15,20,0.38)' }}>
                          VIDEO {video.index + 1}
                        </span>
                        {isDone && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}>Bekeken</span>
                        )}
                        {isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(37,0,245,0.1)', color: '#2500F5' }}>Bezig</span>
                        )}
                        {isNext && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}>Volgende</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold truncate" style={{ color: '#0d0f14' }}>{video.title}</p>
                    </div>
                    {/* Duration + chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs flex items-center gap-1" style={{ color: 'rgba(13,15,20,0.38)' }}>
                        <Clock size={11} />{video.duration}m
                      </span>
                      <ChevronRight size={14} style={{ color: 'rgba(13,15,20,0.2)' }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-3">

          {/* Quick start — mobile only CTA repeated */}
          <Link
            href={heroHref}
            className="sm:hidden flex items-center gap-3 p-4 rounded-xl border"
            style={{ background: '#2500F5', borderColor: '#2500F5' }}
          >
            <Play size={16} fill="white" color="white" />
            <span className="text-sm font-semibold text-white">
              {heroLabel}
            </span>
          </Link>

          {/* Events card */}
          <Link
            href="https://workshops.archerinvest.be"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Archer Invest workshops in een nieuw tabblad"
            className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-md group"
            style={{ background: '#fff', borderColor: '#e8ecf4', boxShadow: '0 1px 3px rgba(13,15,20,0.05)' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
              style={{ background: 'rgba(37,0,245,0.07)' }}>
              <CalendarDays size={17} style={{ color: '#2500F5' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#0d0f14' }}>Events</p>
              <p className="text-xs" style={{ color: 'rgba(13,15,20,0.42)' }}>Invest-avonden</p>
            </div>
            <ChevronRight size={14} style={{ color: 'rgba(13,15,20,0.22)' }} className="shrink-0" />
          </Link>

          {/* Masterclass upgrade card */}
          <div className="rounded-xl border p-4 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(37,0,245,0.06) 0%, rgba(91,64,255,0.06) 100%)', borderColor: 'rgba(37,0,245,0.2)' }}>
            <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.07]"
              style={{ background: 'radial-gradient(circle, #2500F5 0%, transparent 70%)' }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Zap size={14} style={{ color: '#2500F5' }} />
                <p className="text-sm font-bold" style={{ color: '#0d0f14' }}>Masterclass</p>
              </div>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(13,15,20,0.5)' }}>
                Ga verder met de volledige Archer Invest-opleiding
              </p>
              <Link
                href="/masterclass"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full transition-all hover:opacity-90"
                style={{ background: '#2500F5', color: '#fff' }}
              >
                Bekijk programma
                <ChevronRight size={11} />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  )
}
