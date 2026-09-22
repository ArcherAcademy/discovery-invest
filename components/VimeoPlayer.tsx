'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Player from '@vimeo/player'
import { CheckCircle2, ExternalLink, RefreshCw, SkipForward, X, Trophy, FileText } from 'lucide-react'

function parseVimeoId(src: string): number | null {
  const m = src.match(/(?:vimeo\.com\/|video\/)(\d+)/)
  if (m) return Number(m[1])
  if (/^\d+$/.test(src.trim())) return Number(src.trim())
  return null
}

type VimeoUrl = `https://vimeo.com/${string}` | `https://player.vimeo.com/video/${string}`

interface VimeoPlayerProps {
  src: string
  videoDbId: string
  thumbnailUrl?: string | null
  completed: boolean
  initialProgressPct?: number
  nextVideoTitle?: string | null   // null = last video
  nextContentType?: 'video' | 'pdf' | null
  isLastVideo?: boolean
  onUnlockNext?: () => void
  onRealDuration?: (seconds: number) => void
  onCompleted?: () => void
  onAutoNext?: () => void          // called when countdown finishes
}

export default function VimeoPlayer({
  src,
  videoDbId,
  thumbnailUrl: fallbackThumbnailUrl = null,
  completed,
  initialProgressPct = 0,
  nextVideoTitle,
  nextContentType,
  isLastVideo,
  onUnlockNext,
  onRealDuration,
  onCompleted,
  onAutoNext,
}: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const marked = useRef(completed)
  const startedTrackedRef = useRef(false)
  const lastTrackedProgressRef = useRef(Math.floor(initialProgressPct / 10) * 10)
  const progressRequestRef = useRef<Promise<void>>(Promise.resolve())
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onAutoNextRef = useRef(onAutoNext)
  useEffect(() => { onAutoNextRef.current = onAutoNext }, [onAutoNext])

  const [ended, setEnded] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(fallbackThumbnailUrl)

  const vimeoId = parseVimeoId(src)
  const vimeoUrl = (src.startsWith('https://') ? src : `https://vimeo.com/${vimeoId}`) as VimeoUrl

  // Reset all state when video changes
  useEffect(() => {
    marked.current = completed
    startedTrackedRef.current = false
    lastTrackedProgressRef.current = Math.floor(initialProgressPct / 10) * 10
    progressRequestRef.current = Promise.resolve()
    setEnded(false)
    setCountdown(null)
    setCancelled(false)
    setErrorMsg(null)
    setThumbnailUrl(fallbackThumbnailUrl)
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
  }, [videoDbId])

  // ── Countdown logic — fully imperative, immune to React batching races ────
  // Declared BEFORE doComplete because doComplete's deps array references it.
  const startCountdown = useCallback((from: number) => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
    setCountdown(from)
    const tick = (n: number) => {
      countdownTimerRef.current = setTimeout(() => {
        if (n <= 1) {
          setCountdown(0)
          onAutoNextRef.current?.()
        } else {
          setCountdown(n - 1)
          tick(n - 1)
        }
      }, 1000)
    }
    tick(from)
  }, [])

  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
    countdownTimerRef.current = null
    setCountdown(null)
    setCancelled(true)
  }, [])

  const trackProgress = useCallback((action: 'started' | 'progress', progressPct?: number) => {
    progressRequestRef.current = progressRequestRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch('/api/video-progress', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: videoDbId, action, progressPct }),
          keepalive: true,
        })
        if (!response.ok) {
          const body = await response.text().catch(() => '')
          console.error('[v0] video-progress opslaan mislukt:', response.status, body)
        }
      })
  }, [videoDbId])

  // ── doComplete — called by 'ended' and manual button ──────────────────────
  const doComplete = useCallback(async (source: 'ended' | 'manual') => {
    if (marked.current) return
    marked.current = true

    try {
      const res = await fetch('/api/video-complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: videoDbId }),
      })

      if (res.ok) {
        setErrorMsg(null)
        onCompleted?.()
        onUnlockNext?.()
        // Start countdown to next video (only when triggered by 'ended', not manual)
        if (source === 'ended' && !isLastVideo && onAutoNextRef.current) {
          startCountdown(5)
        }
      } else {
        // Log full technical detail server/console-side only — never render it.
        const body = await res.text().catch(() => '')
        console.error('[v0] video-complete failed:', res.status, body)
        setErrorMsg('Er ging iets mis bij het opslaan, probeer opnieuw.')
        marked.current = false // allow retry
      }
    } catch (err) {
      console.error('[v0] video-complete network error:', err)
      setErrorMsg('Er ging iets mis bij het opslaan, probeer opnieuw.')
      marked.current = false
    }
  }, [videoDbId, onCompleted, onUnlockNext, isLastVideo, startCountdown])

  // ── Player init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !vimeoId) return

    const player = new Player(containerRef.current, {
      url: vimeoUrl,
      responsive: true,
      title: false,
      byline: false,
      portrait: false,
      pip: false,
      dnt: true,
      color: '2500f5',
    })
    playerRef.current = player

    // Laad de thumbnail los van de speler, zodat ook een geblokkeerde embed een nette fallback heeft.
    fetch(`https://vimeo.com/api/v2/video/${vimeoId}.json`)
      .then(response => response.ok ? response.json() : null)
      .then(json => setThumbnailUrl(json?.[0]?.thumbnail_large ?? null))
      .catch(() => undefined)

    player.ready().then(async () => {
      try {
        const d = await player.getDuration()
        if (d && d > 0) {
          onRealDuration?.(d)
          if (!completed && initialProgressPct > 0 && initialProgressPct < 90) {
            await player.setCurrentTime(d * (initialProgressPct / 100))
          }
        }
      } catch { /* ignore */ }
    }).catch((err: unknown) => {
      console.error('[v0] Vimeo player failed to load:', err)
      setErrorMsg('Er ging iets mis bij het laden van de video, probeer opnieuw.')
    })

    player.on('error', (err: unknown) => {
      console.error('[v0] Vimeo player SDK error:', err)
      setErrorMsg('Er ging iets mis bij het laden van de video, probeer opnieuw.')
    })

    const handlePlay = () => {
      if (marked.current || startedTrackedRef.current) return
      startedTrackedRef.current = true
      trackProgress('started')
    }

    const handleTimeUpdate = ({ percent }: { percent: number }) => {
      if (marked.current || !Number.isFinite(percent)) return
      const progressPct = Math.min(99, Math.floor((percent * 100) / 10) * 10)
      if (progressPct < 10 || progressPct <= lastTrackedProgressRef.current) return
      lastTrackedProgressRef.current = progressPct
      trackProgress('progress', progressPct)
    }

    const handleEnded = () => {
      setEnded(true)
      doComplete('ended')
    }

    player.on('play', handlePlay)
    player.on('timeupdate', handleTimeUpdate)
    player.on('ended', handleEnded)

    return () => {
      player.off('play', handlePlay)
      player.off('timeupdate', handleTimeUpdate)
      player.off('ended', handleEnded)
      player.off('error')
      player.destroy().catch(() => {})
      playerRef.current = null
    }
  }, [src, vimeoId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!vimeoId) {
    return (
      <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16/9', background: '#080a10' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Geen geldig Vimeo-ID</p>
      </div>
    )
  }

  const playerLoadError = errorMsg?.includes('laden van de video') ?? false
  const vimeoPageUrl = `https://vimeo.com/${vimeoId}`

  return (
    <div className="w-full">
      {/* Player + end-screen overlay */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#000', borderRadius: '1rem', overflow: 'hidden' }}>
        {/* Vimeo player container */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {playerLoadError && !ended && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 px-6 text-center"
            style={{
              background: thumbnailUrl
                ? `linear-gradient(rgba(8,10,16,0.68), rgba(8,10,16,0.9)), url(${thumbnailUrl}) center/cover no-repeat`
                : '#080a10',
            }}
          >
            <div className="flex max-w-sm flex-col gap-1">
              <p className="text-base font-bold text-primary-foreground">Video kan hier niet afspelen</p>
              <p className="text-sm leading-5 text-primary-foreground/65">Open de video rechtstreeks in Vimeo om meteen verder te kijken.</p>
            </div>
            <a
              href={vimeoPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ExternalLink size={16} />
              Open video
            </a>
          </div>
        )}

        {/* End screen overlay — appears when video ends */}
        {ended && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-20 transition-opacity duration-500"
            style={{
              background: thumbnailUrl
                ? `linear-gradient(rgba(8,10,16,0.72) 0%, rgba(8,10,16,0.85) 100%), url(${thumbnailUrl}) center/cover no-repeat`
                : 'rgba(8,10,16,0.88)',
              pointerEvents: 'auto',
            }}
          >
            {isLastVideo ? (
              /* Last video — 6/6 celebration */
              <div className="flex flex-col items-center gap-4 text-center px-8">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(37,0,245,0.2)', border: '1.5px solid rgba(37,0,245,0.4)' }}
                >
                  <Trophy size={28} style={{ color: '#2500F5' }} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">Alle video&apos;s bekeken</p>
                  <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Je bonusmateriaal is vrijgespeeld.
                  </p>
                </div>
                <button
                  onClick={onAutoNext}
                  className="mt-2 flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
                  style={{ background: '#2500F5', color: '#fff', boxShadow: '0 4px 16px rgba(37,0,245,0.45)' }}
                >
                  Bekijk je bonus
                </button>
              </div>
            ) : (
              /* Regular video — countdown to next */
              <div className="flex flex-col items-center gap-5 text-center px-8">
                {nextContentType === 'pdf' ? (
                  <FileText size={36} style={{ color: '#2500F5' }} />
                ) : (
                  <CheckCircle2 size={36} style={{ color: '#2500F5' }} />
                )}

                {!cancelled && onAutoNext && (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-white font-semibold text-sm">
                      {nextContentType === 'pdf' ? 'Volgende: PDF-gids' : 'Volgende video'}
                    </p>
                    {nextVideoTitle && (
                      <p className="text-xs max-w-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {nextVideoTitle}
                      </p>
                    )}
                  </div>
                )}

                {!cancelled && onAutoNext && countdown !== null && countdown > 0 && (
                  <div className="flex items-center gap-3">
                    {/* Countdown ring */}
                    <div className="relative w-14 h-14 flex items-center justify-center">
                      <svg className="absolute inset-0" width="56" height="56" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                        <circle
                          cx="28" cy="28" r="24"
                          fill="none" stroke="#2500F5" strokeWidth="3"
                          strokeDasharray={`${2 * Math.PI * 24}`}
                          strokeDashoffset={`${2 * Math.PI * 24 * (1 - countdown / 5)}`}
                          strokeLinecap="round"
                          transform="rotate(-90 28 28)"
                          style={{ transition: 'stroke-dashoffset 1s linear' }}
                        />
                      </svg>
                      <span className="text-white font-bold text-lg z-10">{countdown}</span>
                    </div>

                    <button
                      onClick={() => { stopCountdown(); onAutoNextRef.current?.() }}
                      className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-all"
                      style={{ background: '#2500F5', color: '#fff', boxShadow: '0 4px 16px rgba(37,0,245,0.4)', pointerEvents: 'auto' }}
                    >
                      <SkipForward size={14} />
                      Nu door
                    </button>
                  </div>
                )}

                {/* Annuleer */}
                {!cancelled && onAutoNext && (
                  <button
                    onClick={stopCountdown}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors"
                    style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)', pointerEvents: 'auto' }}
                  >
                    <X size={11} />
                    Blijf hier
                  </button>
                )}

                {/* After cancel or no auto-next */}
                {(cancelled || !onAutoNext) && (
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Video bekeken — gebruik de navigatie onderaan om door te gaan.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error + fallback button — only shown on error */}
      {((errorMsg && !playerLoadError) || (ended && !marked.current)) && (
        <div className="flex items-center justify-between gap-3 mt-2 px-1">
          {errorMsg && !playerLoadError && (
            <span className="text-xs" style={{ color: '#dc2626' }}>
              {errorMsg}
            </span>
          )}
          {!marked.current && ended && (
            <button
              onClick={() => doComplete('manual')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
              style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
            >
              <RefreshCw size={11} />
              Markeer als bekeken
            </button>
          )}
        </div>
      )}
    </div>
  )
}
