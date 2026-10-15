'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Player from '@vimeo/player'
import { CheckCircle2, ExternalLink, FileText, Maximize2, Minimize2, Pause, Play, RefreshCw, SkipForward, Trophy, Volume2, VolumeX, X } from 'lucide-react'

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

function formatVideoTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function getPlayerErrorMessage(error: unknown) {
  const playerError = error as { name?: string; message?: string } | null
  if (playerError?.name === 'PrivacyError' || playerError?.message?.toLowerCase().includes('privacy')) {
    return 'Deze video is door Vimeo niet vrijgegeven voor dit domein. Probeer opnieuw of open de video rechtstreeks in Vimeo.'
  }
  return 'Er ging iets mis bij het laden van de video, probeer opnieuw.'
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
  autoPlay?: boolean
  nextVideoTitle?: string | null   // null = last video
  nextContentType?: 'video' | 'pdf' | null
  isLastVideo?: boolean
  requireEndedForCompletion?: boolean
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
  autoPlay = false,
  nextVideoTitle,
  nextContentType,
  isLastVideo,
  requireEndedForCompletion = false,
  onUnlockNext,
  onRealDuration,
  onCompleted,
  onAutoNext,
}: VimeoPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const marked = useRef(completed)
  const startedTrackedRef = useRef(false)
  const lastTrackedProgressRef = useRef(Math.floor(initialProgressPct / 10) * 10)
  const progressRequestRef = useRef<Promise<void>>(Promise.resolve())
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatRef = useRef<(() => Promise<void>) | null>(null)
  const heartbeatFailuresRef = useRef(0)
  const maxWatchedTimeRef = useRef(0)
  // Video 6: al stil opgeslagen bij 90%, de afsluitende UI wacht nog op het echte einde.
  const pendingCompletionUiRef = useRef(false)
  const endedRef = useRef(false)
  const onAutoNextRef = useRef(onAutoNext)
  useEffect(() => { onAutoNextRef.current = onAutoNext }, [onAutoNext])

  const [ended, setEnded] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [maxWatchedTime, setMaxWatchedTime] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [playerRetryKey, setPlayerRetryKey] = useState(0)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(fallbackThumbnailUrl)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const vimeoId = parseVimeoId(src)
  const vimeoUrl = (src.startsWith('https://') ? src : `https://vimeo.com/${vimeoId}`) as VimeoUrl

  // Reset all state when video changes
  useEffect(() => {
    marked.current = completed
    pendingCompletionUiRef.current = false
    endedRef.current = false
    startedTrackedRef.current = false
    lastTrackedProgressRef.current = Math.floor(initialProgressPct / 10) * 10
    progressRequestRef.current = Promise.resolve()
    heartbeatFailuresRef.current = 0
    setEnded(false)
    setHasStarted(false)
    setIsPlaying(false)
    maxWatchedTimeRef.current = 0
    setCurrentTime(0)
    setDuration(0)
    setMaxWatchedTime(0)
    setPlayerReady(false)
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

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

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
  const doComplete = useCallback(async (source: 'threshold' | 'ended' | 'manual' | 'silent') => {
    if (source === 'silent') {
      // Laatste kernvideo bij 90%: sla de voltooiing op zodat wie de laatste seconden
      // overslaat of het tabblad sluit toch op 6/6 komt. De editiekeuze blijft wachten op 'ended'.
      if (marked.current) return
      marked.current = true
      try {
        await postWithRetry('/api/video-complete', { videoId: videoDbId })
        if (endedRef.current) {
          onCompleted?.()
          onUnlockNext?.()
        } else {
          pendingCompletionUiRef.current = true
        }
      } catch (error) {
        console.error('[v0] stille voltooiing video 6 mislukt, einde probeert opnieuw:', error)
        marked.current = false
      }
      return
    }
    if (marked.current) {
      if (source === 'ended' && pendingCompletionUiRef.current) {
        pendingCompletionUiRef.current = false
        onCompleted?.()
        onUnlockNext?.()
      }
      if (source === 'ended' && isLastVideo) onAutoNextRef.current?.()
      if (source === 'ended' && !isLastVideo && onAutoNextRef.current) startCountdown(5)
      return
    }
    marked.current = true
    setRetrying(source === 'manual')

    // Bij video 6 gaat de gebruiker meteen naar de inschrijfpagina zodra Vimeo het echte einde meldt.
    // De opslag en externe synchronisaties mogen die gebruikersfeedback niet vertragen.
    if (source === 'ended' && isLastVideo) onAutoNextRef.current?.()

    try {
      await postWithRetry('/api/video-complete', { videoId: videoDbId })
      setErrorMsg(null)
      setTrackingError(null)
      onCompleted?.()
      onUnlockNext?.()
      if (!isLastVideo && source === 'ended' && onAutoNextRef.current) {
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

    // Vimeo gebruikt de verwijzer om domeinprivacy te controleren. De SDK maakt
    // normaal zelf een iframe aan; dat verliest op sommige browsers de verwijzer.
    // Maak het iframe expliciet aan zodat embeds op het live domein betrouwbaar werken.
    const iframe = document.createElement('iframe')
    const playerUrl = new URL(vimeoUrl)
    playerUrl.searchParams.set('controls', '0')
    playerUrl.searchParams.set('title', '0')
    playerUrl.searchParams.set('byline', '0')
    playerUrl.searchParams.set('portrait', '0')
    playerUrl.searchParams.set('pip', '0')
    playerUrl.searchParams.set('keyboard', '0')
    if (autoPlay) playerUrl.searchParams.set('autoplay', '1')
    iframe.src = playerUrl.toString()
    iframe.title = 'Archer Invest video'
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media; web-share'
    iframe.allowFullscreen = true
    iframe.referrerPolicy = 'origin'
    iframe.loading = 'eager'
    iframe.className = 'absolute inset-0 size-full border-0'
    containerRef.current.appendChild(iframe)

    const player = new Player(iframe)
    playerRef.current = player

    const registerStarted = () => {
      setHasStarted(true)
      if (marked.current || startedTrackedRef.current) return
      startedTrackedRef.current = true
      trackProgress('started')
    }

    const registerWatchedTime = (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= maxWatchedTimeRef.current) return
      maxWatchedTimeRef.current = seconds
      setMaxWatchedTime(seconds)
    }

    const registerPercent = (percent: number) => {
      if (!Number.isFinite(percent) || percent < 0) return
      if (percent > 0) registerStarted()

      // Elke video telt vanaf 90%. Bij de laatste kernvideo gebeurt dat stil;
      // de editiekeuze verschijnt pas wanneer Vimeo daadwerkelijk het einde meldt.
      if (percent >= 0.9) {
        void doComplete(requireEndedForCompletion ? 'silent' : 'threshold')
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
        setCurrentTime(currentTime)
        setDuration(duration)
        registerWatchedTime(currentTime)
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

    // Vimeo onthoudt soms een eerder gekozen stille stand; forceer daarom altijd geluid aan.
    const enableSound = async () => {
      try {
        await withTimeout(player.setMuted(false), PLAYER_CALL_TIMEOUT_MS)
        await withTimeout(player.setVolume(1), PLAYER_CALL_TIMEOUT_MS)
        if (!disposed) setIsMuted(false)
      } catch (error) {
        console.error('[v0] Geluid aanzetten mislukt:', error)
      }
    }

    const unmuteOnGesture = () => {
      removeGestureListeners()
      void enableSound()
    }
    const removeGestureListeners = () => {
      window.removeEventListener('pointerdown', unmuteOnGesture)
      window.removeEventListener('keydown', unmuteOnGesture)
    }
    const armUnmuteOnGesture = () => {
      window.addEventListener('pointerdown', unmuteOnGesture, { once: true })
      window.addEventListener('keydown', unmuteOnGesture, { once: true })
    }

    player.ready().then(async () => {
      try {
        setPlayerReady(true)
        const duration = await withTimeout(player.getDuration(), PLAYER_CALL_TIMEOUT_MS)
        if (disposed || !duration || duration <= 0) return
        onRealDuration?.(duration)
        setDuration(duration)
        if (completed) {
          maxWatchedTimeRef.current = duration
          setMaxWatchedTime(duration)
        } else if (initialProgressPct > 0 && initialProgressPct < 90) {
          const resumedAt = duration * (initialProgressPct / 100)
          maxWatchedTimeRef.current = resumedAt
          setMaxWatchedTime(resumedAt)
          await withTimeout(player.setCurrentTime(resumedAt), PLAYER_CALL_TIMEOUT_MS)
        }
        await enableSound()
        if (autoPlay) {
          try {
            await withTimeout(player.play(), PLAYER_CALL_TIMEOUT_MS)
          } catch {
            // Browsers blokkeren soms autoplay met geluid. Speel dan stil af en zet
            // het geluid aan bij de eerste klik of toets van de gebruiker.
            try {
              await withTimeout(player.setMuted(true), PLAYER_CALL_TIMEOUT_MS)
              setIsMuted(true)
              await withTimeout(player.play(), PLAYER_CALL_TIMEOUT_MS)
              armUnmuteOnGesture()
            } catch {
              // De posterknop blijft beschikbaar om handmatig te starten.
            }
          }
        }
        await heartbeat()
      } catch (error) {
        console.error('[v0] Vimeo initialisatie nog niet klaar; hartslag blijft proberen:', error)
      }
    }).catch((error: unknown) => {
      console.error('[v0] Vimeo player ready mislukt; hartslag blijft proberen:', error)
      setErrorMsg(getPlayerErrorMessage(error))
    })

    player.on('error', (error: unknown) => {
      console.error('[v0] Vimeo player SDK error:', error)
      setErrorMsg(getPlayerErrorMessage(error))
    })

    const handlePlay = () => {
      setIsPlaying(true)
      registerStarted()
    }
    const handlePause = () => setIsPlaying(false)
    const handleTimeUpdate = ({ percent, seconds, duration: eventDuration }: { percent: number; seconds: number; duration: number }) => {
      setCurrentTime(seconds)
      setDuration(eventDuration)
      registerWatchedTime(seconds)
      registerPercent(percent)
    }
    const handleEnded = () => {
      setIsPlaying(false)
      setEnded(true)
      endedRef.current = true
      void doComplete('ended')
    }

    player.on('play', handlePlay)
    player.on('pause', handlePause)
    player.on('timeupdate', handleTimeUpdate)
    player.on('ended', handleEnded)

    void heartbeat()
    const heartbeatTimer = window.setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS)

    return () => {
      disposed = true
      removeGestureListeners()
      window.clearInterval(heartbeatTimer)
      heartbeatRef.current = null
      player.off('play', handlePlay)
      player.off('pause', handlePause)
      player.off('timeupdate', handleTimeUpdate)
      player.off('ended', handleEnded)
      player.off('error')
      player.destroy().catch(() => {})
      playerRef.current = null
    }
  }, [src, vimeoId, playerRetryKey, autoPlay]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!vimeoId) {
    return (
      <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16/9', background: '#080a10' }}>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Geen geldig Vimeo-ID</p>
      </div>
    )
  }

  const playerLoadError = Boolean(errorMsg?.includes('laden van de video') || errorMsg?.includes('niet vrijgegeven voor dit domein'))
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

  const togglePlayback = async () => {
    try {
      if (isPlaying) {
        await playerRef.current?.pause()
      } else {
        await playerRef.current?.play()
      }
    } catch (error) {
      console.error('[v0] Vimeo afspeelbediening mislukt:', error)
      setErrorMsg('De videobediening reageert niet. Probeer opnieuw.')
    }
  }

  const seekTo = async (seconds: number) => {
    if (!playerReady || !playerRef.current) return
    const seekLimit = completed ? duration : maxWatchedTimeRef.current
    const safeTime = Math.max(0, Math.min(seconds, seekLimit))

    try {
      setCurrentTime(safeTime)
      await playerRef.current.setCurrentTime(safeTime)
    } catch (error) {
      console.error('[v0] Video terugspoelen mislukt:', error)
      setErrorMsg('Terugspoelen lukte niet. Probeer opnieuw.')
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }
      if (wrapperRef.current?.requestFullscreen) {
        await wrapperRef.current.requestFullscreen()
      } else {
        await playerRef.current?.requestFullscreen()
      }
      await playerRef.current?.play()
      setHasStarted(true)
    } catch (error) {
      console.error('[v0] Volledig scherm wisselen mislukt:', error)
      setErrorMsg('Volledig scherm kon niet worden gewisseld. Probeer opnieuw.')
    }
  }

  const toggleMute = async () => {
    if (!playerReady || !playerRef.current) return
    try {
      const nextMuted = !isMuted
      await playerRef.current.setMuted(nextMuted)
      if (!nextMuted) await playerRef.current.setVolume(1)
      setIsMuted(nextMuted)
    } catch (error) {
      console.error('[v0] Geluid wisselen mislukt:', error)
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
      <div
        ref={wrapperRef}
        className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-black fullscreen:h-screen fullscreen:aspect-auto fullscreen:rounded-none"
      >
        {/* Vimeo rendert alleen de video. De bediening hieronder is volledig van Archer. */}
        <div ref={containerRef} className="absolute inset-0 size-full" />

        {!hasStarted && !playerLoadError && thumbnailUrl && (
          <button
            type="button"
            onClick={handlePosterPlay}
            aria-label="Video afspelen"
            className="absolute inset-0 z-10 overflow-hidden bg-background focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
          >
            <img src={thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
          </button>
        )}

        {!playerLoadError && !ended && (
          <div
            className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex items-center justify-between text-foreground sm:inset-x-4 sm:bottom-4"
          >
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!playerReady}
              aria-label={isPlaying ? 'Video pauzeren' : 'Video afspelen'}
              className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-border/40 bg-background/85 shadow-lg backdrop-blur-md transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
            >
              {isPlaying ? <Pause className="size-5 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />}
            </button>
            {duration > 0 && (
              <div className="mx-3 flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-10 text-right text-sm font-medium tabular-nums text-primary-foreground">
                  {formatVideoTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={Math.min(currentTime, duration)}
                  onChange={(event) => void seekTo(Number(event.currentTarget.value))}
                  disabled={!playerReady || maxWatchedTime <= 0}
                  aria-label="Video terugspoelen"
                  aria-valuetext={`${formatVideoTime(currentTime)} van ${formatVideoTime(duration)} bekeken`}
                  className="pointer-events-auto h-2 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-wait disabled:opacity-60"
                />
                <span className="min-w-10 text-sm font-medium tabular-nums text-primary-foreground">
                  {formatVideoTime(duration)}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={toggleMute}
              disabled={!playerReady}
              aria-label={isMuted ? 'Geluid aanzetten' : 'Geluid uitzetten'}
              aria-pressed={isMuted}
              className="pointer-events-auto mr-2 flex size-11 items-center justify-center rounded-full border border-border/40 bg-background/85 shadow-lg backdrop-blur-md transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
            >
              {isMuted ? <VolumeX className="size-5" aria-hidden="true" /> : <Volume2 className="size-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
            onClick={toggleFullscreen}
            disabled={!playerReady}
            aria-label={isFullscreen ? 'Volledig scherm sluiten' : 'Video op volledig scherm bekijken'}
            aria-pressed={isFullscreen}
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-border/40 bg-background/85 shadow-lg backdrop-blur-md transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-50"
          >
            {isFullscreen ? <Minimize2 className="size-5" aria-hidden="true" /> : <Maximize2 className="size-5" aria-hidden="true" />}
          </button>
          </div>
        )}

        {playerLoadError && !ended && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 overflow-y-auto px-3 py-2 text-center sm:gap-4 sm:px-6"
            style={{
              background: thumbnailUrl
                ? `linear-gradient(rgba(8,10,16,0.68), rgba(8,10,16,0.9)), url(${thumbnailUrl}) center/cover no-repeat`
                : '#080a10',
            }}
          >
            <div className="flex max-w-sm flex-col gap-1">
              <p className="text-sm font-bold text-primary-foreground sm:text-base">Video kan hier niet afspelen</p>
              <p className="hidden text-sm leading-5 text-primary-foreground/65 sm:block">Open de video rechtstreeks in Vimeo om meteen verder te kijken.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={retryPlayer}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-11 sm:px-5"
              >
                <RefreshCw size={16} />
                Probeer opnieuw
              </button>
              <a
                href={vimeoPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-foreground/25 px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-11 sm:px-5"
              >
                <ExternalLink size={16} />
                Open in Vimeo
              </a>
              {!completed && !requireEndedForCompletion && (
                <button
                  type="button"
                  onClick={() => doComplete('manual')}
                  disabled={retrying}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary-foreground/25 px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-11 sm:px-5"
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
