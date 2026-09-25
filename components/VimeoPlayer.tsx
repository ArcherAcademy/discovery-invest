'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Player from '@vimeo/player'
import { CheckCircle2, ExternalLink, FileText, Play, RefreshCw, SkipForward, Trophy, X } from 'lucide-react'

function parseVimeoId(src: string): number | null {
  const m = src.match(/(?:vimeo\.com\/|video\/)(\d+)/)
  if (m) return Number(m[1])
  if (/^\d+$/.test(src.trim())) return Number(src.trim())
  return null
}

type VimeoUrl = `https://vimeo.com/${string}` | `https://player.vimeo.com/video/${string}`

const HEARTBEAT_INTERVAL_MS = 5_000
const PLAYER_CALL_TIMEOUT_MS = 4_000
const MAX_REQUEST_ATTEMPTS = 3

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('player_timeout')), timeoutMs)
    }),
  ])
}

async function postWithRetry(url: string, body: Record<string, unknown>, keepalive = false) {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive,
      })

      if (response.ok) return response

      const responseBody = await response.text().catch(() => '')
      lastError = new Error(`${response.status}: ${responseBody}`)
      if (response.status < 500 && response.status !== 408 && response.status !== 429) break
    } catch (error) {
      lastError = error
    }

    if (attempt < MAX_REQUEST_ATTEMPTS) await wait(400 * 2 ** (attempt - 1))
  }

  throw lastError instanceof Error ? lastError : new Error('request_failed')
}

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
  const heartbeatRef = useRef<(() => Promise<void>) | null>(null)
  const heartbeatFailuresRef = useRef(0)
  const onAutoNextRef = useRef(onAutoNext)
  useEffect(() => { onAutoNextRef.current = onAutoNext }, [onAutoNext])

  const [ended, setEnded] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [playerRetryKey, setPlayerRetryKey] = useState(0)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(fallbackThumbnailUrl)

  const vimeoId = parseVimeoId(src)
  const vimeoUrl = (src.startsWith('https://') ? src : `https://vimeo.com/${vimeoId}`) as VimeoUrl

  // Reset all state when video changes
  useEffect(() => {
    marked.current = completed
    startedTrackedRef.current = false
    lastTrackedProgressRef.current = Math.floor(initialProgressPct / 10) * 10
    progressRequestRef.current = Promise.resolve()
    heartbeatFailuresRef.current = 0
    setEnded(false)
    setHasStarted(false)
    setCountdown(null)
    setCancelled(false)
    setErrorMsg(null)
    setTrackingError(null)
    setRetrying(false)
    setThumbnailUrl(fallbackThumbnailUrl)
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current)
  }, [videoDbId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (completed) marked.current = true
  }, [completed])

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
        try {
          await postWithRetry('/api/video-progress', { videoId: videoDbId, action, progressPct }, true)
          setTrackingError(null)
        } catch (error) {
          console.error('[v0] video-progress opslaan mislukt na retries:', error)
          if (!marked.current) {
            setTrackingError('Je videovoortgang kon niet worden opgeslagen. Controleer je verbinding en probeer opnieuw.')
          }
        }
      })
  }, [videoDbId])

  // ── doComplete — called at 90%, by 'ended' and by the manual fallback ─────
  const doComplete = useCallback(async (source: 'threshold' | 'ended' | 'manual') => {
    if (marked.current) {
      if (source === 'ended' && isLastVideo) onAutoNextRef.current?.()
      if (source === 'ended' && !isLastVideo && onAutoNextRef.current) startCountdown(5)
      return
    }
    marked.current = true
    setRetrying(source === 'manual')

    try {
      await postWithRetry('/api/video-complete', { videoId: videoDbId })
      setErrorMsg(null)
      setTrackingError(null)
      onCompleted?.()
      onUnlockNext?.()
      if (source === 'ended' && !isLastVideo && onAutoNextRef.current) {
        startCountdown(5)
      }
    } catch (error) {
      console.error('[v0] video-complete mislukt na retries:', error)
      setErrorMsg('Je voltooiing kon niet worden opgeslagen. Probeer opnieuw om verder te gaan.')
      marked.current = false
    } finally {
      setRetrying(false)
    }
  }, [videoDbId, onCompleted, onUnlockNext, isLastVideo, startCountdown])

  // ── Player init + onafhankelijke hartslag ──────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !vimeoId) return

    containerRef.current.replaceChildren()
    let disposed = false

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

    const registerStarted = () => {
      setHasStarted(true)
      if (marked.current || startedTrackedRef.current) return
      startedTrackedRef.current = true
      trackProgress('started')
    }

    const registerPercent = (percent: number) => {
      if (!Number.isFinite(percent) || percent < 0) return
      if (percent > 0) registerStarted()

      // Completion is checked on every event/poll, before 10%-step throttling.
      if (percent >= 0.9) {
        void doComplete('threshold')
        return
      }
      if (marked.current) return

      const progressPct = Math.min(89, Math.floor((percent * 100) / 10) * 10)
      if (progressPct < 10 || progressPct <= lastTrackedProgressRef.current) return
      lastTrackedProgressRef.current = progressPct
      trackProgress('progress', progressPct)
    }

    const heartbeat = async () => {
      try {
        const [currentTime, duration] = await Promise.all([
          withTimeout(player.getCurrentTime(), PLAYER_CALL_TIMEOUT_MS),
          withTimeout(player.getDuration(), PLAYER_CALL_TIMEOUT_MS),
        ])
        if (disposed || !duration || duration <= 0) return

        heartbeatFailuresRef.current = 0
        onRealDuration?.(duration)
        registerPercent(currentTime / duration)
        setErrorMsg(current => current?.includes('laden van de video') ? null : current)
      } catch (error) {
        if (disposed) return
        heartbeatFailuresRef.current += 1
        if (heartbeatFailuresRef.current >= 4) {
          console.error('[v0] Vimeo hartslag faalt herhaaldelijk:', error)
          setErrorMsg('Er ging iets mis bij het laden van de video, probeer opnieuw.')
        }
      }
    }
    heartbeatRef.current = heartbeat

    player.ready().then(async () => {
      try {
        const duration = await withTimeout(player.getDuration(), PLAYER_CALL_TIMEOUT_MS)
        if (disposed || !duration || duration <= 0) return
        onRealDuration?.(duration)
        if (!completed && initialProgressPct > 0 && initialProgressPct < 90) {
          await withTimeout(player.setCurrentTime(duration * (initialProgressPct / 100)), PLAYER_CALL_TIMEOUT_MS)
        }
        await heartbeat()
      } catch (error) {
        console.error('[v0] Vimeo initialisatie nog niet klaar; hartslag blijft proberen:', error)
      }
    }).catch((error: unknown) => {
      console.error('[v0] Vimeo player ready mislukt; hartslag blijft proberen:', error)
    })

    player.on('error', (error: unknown) => {
      console.error('[v0] Vimeo player SDK error:', error)
      setErrorMsg('Er ging iets mis bij het laden van de video, probeer opnieuw.')
    })

    const handlePlay = () => registerStarted()
    const handleTimeUpdate = ({ percent }: { percent: number }) => registerPercent(percent)
    const handleEnded = () => {
      setEnded(true)
      void doComplete('ended')
    }

    player.on('play', handlePlay)
    player.on('timeupdate', handleTimeUpdate)
    player.on('ended', handleEnded)

    void heartbeat()
    const heartbeatTimer = window.setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(heartbeatTimer)
      heartbeatRef.current = null
      player.off('play', handlePlay)
      player.off('timeupdate', handleTimeUpdate)
      player.off('ended', handleEnded)
      player.off('error')
      player.destroy().catch(() => {})
      playerRef.current = null
    }
  }, [src, vimeoId, playerRetryKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!vimeoId) {
    return (
      <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16/9', background: '#080a10' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Geen geldig Vimeo-ID</p>
      </div>
    )
  }

  const playerLoadError = errorMsg?.includes('laden van de video') ?? false
  const vimeoPageUrl = `https://vimeo.com/${vimeoId}`

  const handlePosterPlay = async () => {
    try {
      await playerRef.current?.play()
      setHasStarted(true)
    } catch (error) {
      console.error('[v0] Vimeo play starten mislukt:', error)
      setErrorMsg('Er ging iets mis bij het laden van de video, probeer opnieuw.')
    }
  }

  const retryPlayer = () => {
    heartbeatFailuresRef.current = 0
    setErrorMsg(null)
    setTrackingError(null)
    setPlayerRetryKey(key => key + 1)
  }

  const retryTracking = async () => {
    setRetrying(true)
    setTrackingError(null)
    try {
      await heartbeatRef.current?.()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="w-full">
      {/* Player + end-screen overlay */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#000', borderRadius: '1rem', overflow: 'hidden' }}>
        {/* Vimeo player container */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {!hasStarted && !playerLoadError && thumbnailUrl && (
          <button
            type="button"
            onClick={handlePosterPlay}
            aria-label="Video afspelen"
            className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <img src={thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
            <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105">
              <Play size={24} fill="currentColor" className="ml-1" />
            </span>
          </button>
        )}

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
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={retryPlayer}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <RefreshCw size={16} />
                Probeer opnieuw
              </button>
              <a
                href={vimeoPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-foreground/25 px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ExternalLink size={16} />
                Open in Vimeo
              </a>
              {!completed && (
                <button
                  type="button"
                  onClick={() => doComplete('manual')}
                  disabled={retrying}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-foreground/25 px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <CheckCircle2 size={16} />
                  Markeer als bekeken
                </button>
              )}
            </div>
          </div>
        )}

        {/* End screen overlay — appears when video ends */}
        {ended && !isLastVideo && (
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

      {/* Opslagstatus en expliciete uitweg — voortgang mag nooit stil falen. */}
      {((errorMsg && !playerLoadError) || trackingError || (ended && !marked.current)) && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="text-sm leading-5 text-destructive">
            {errorMsg && !playerLoadError ? errorMsg : trackingError ?? 'Je video is afgelopen, maar de voltooiing is nog niet opgeslagen.'}
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {trackingError && (
              <button
                type="button"
                onClick={retryTracking}
                disabled={retrying}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Opnieuw proberen
              </button>
            )}
            {!marked.current && (ended || Boolean(errorMsg)) && (
              <button
                type="button"
                onClick={() => doComplete('manual')}
                disabled={retrying}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                Markeer als bekeken
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
