'use client'

import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'

const INTRO_COOKIE_PREFIX = 'archer_platform_intro_seen'

interface PlatformIntroModalProps {
  accountKey: string | null
  isNewAccount: boolean
  firstVideoId: string | null
}

export default function PlatformIntroModal({ accountKey, isNewAccount, firstVideoId }: PlatformIntroModalProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [progress, setProgress] = useState(0)
  const hasContinuedRef = useRef(false)
  const cookieName = accountKey
    ? `${INTRO_COOKIE_PREFIX}_${accountKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : null

  useEffect(() => {
    if (!cookieName || !isNewAccount) return

    const hasSeenIntro = document.cookie
      .split('; ')
      .some(cookie => cookie.startsWith(`${cookieName}=`))

    if (!hasSeenIntro) setOpen(true)
  }, [cookieName, isNewAccount])

  useEffect(() => {
    if (!open || !isPlaying) return

    let animationFrame = 0
    const syncProgress = () => {
      const video = videoRef.current
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        setProgress(Math.min(100, (video.currentTime / video.duration) * 100))
      }
      animationFrame = window.requestAnimationFrame(syncProgress)
    }

    animationFrame = window.requestAnimationFrame(syncProgress)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [open, isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!open || !video) return

    const unmuteOnGesture = () => {
      removeGestureListeners()
      video.muted = false
      setIsMuted(false)
    }
    const removeGestureListeners = () => {
      window.removeEventListener('pointerdown', unmuteOnGesture)
      window.removeEventListener('keydown', unmuteOnGesture)
    }

    video.muted = false
    setIsMuted(false)
    video.play().catch(() => {
      // Browsers blokkeren soms autoplay met geluid. Speel dan stil af en zet
      // het geluid aan bij de eerste klik of toets van de gebruiker.
      video.muted = true
      setIsMuted(true)
      video.play().catch(() => {})
      window.addEventListener('pointerdown', unmuteOnGesture, { once: true })
      window.addEventListener('keydown', unmuteOnGesture, { once: true })
    })

    return removeGestureListeners
  }, [open])

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  function markAsSeen() {
    if (cookieName) {
      document.cookie = `${cookieName}=1; Max-Age=31536000; Path=/; SameSite=Lax`
    }
  }

  function close() {
    markAsSeen()
    setOpen(false)
  }

  function continueToFirstVideo() {
    if (hasContinuedRef.current || !firstVideoId) return
    hasContinuedRef.current = true
    markAsSeen()
    setOpen(false)
    router.push(`/video/${firstVideoId}?autoplay=1`)
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget
    if (!Number.isFinite(video.duration) || video.duration <= 0) return
    setProgress(Math.min(100, (video.currentTime / video.duration) * 100))
  }

  async function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    try {
      if (video.paused) {
        await video.play()
      } else {
        video.pause()
      }
    } catch (error) {
      console.error('[v0] Introductievideo bedienen mislukt:', error)
    }
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setIsMuted(nextMuted)
  }

  async function toggleFullscreen() {
    const target = playerRef.current
    if (!target) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (target.requestFullscreen) {
        await target.requestFullscreen()
      }
    } catch (error) {
      console.error('[v0] Introductievideo volledig scherm wisselen mislukt:', error)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/70 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-intro-title"
    >
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-transparent shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <button
          type="button"
          onClick={close}
          aria-label="Introductievideo sluiten"
          className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-background/75 text-foreground/70 shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X size={17} aria-hidden="true" />
        </button>

        <div ref={playerRef} className="relative aspect-video overflow-hidden rounded-2xl bg-foreground">
          <video
            ref={videoRef}
            src="/platform-intro-subtitles.mp4"
            aria-label="Introductievideo met ondertitels"
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              setIsPlaying(false)
              setProgress(100)
              continueToFirstVideo()
            }}
            className="absolute inset-0 size-full object-contain"
          />

          <div
            role="progressbar"
            aria-label="Voortgang van de introductievideo"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="absolute inset-x-0 bottom-0 z-10 h-1 bg-background/25"
          >
            <div
              className="h-full w-full origin-left bg-primary will-change-transform"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>

          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-full bg-background/70 p-1 text-foreground shadow-sm backdrop-blur-md sm:bottom-4 sm:right-4">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Introductievideo pauzeren' : 'Introductievideo afspelen'}
              className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isPlaying ? <Pause className="size-4 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Geluid aanzetten' : 'Geluid uitzetten'}
              aria-pressed={!isMuted}
              className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isMuted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Volledig scherm sluiten' : 'Introductievideo op volledig scherm bekijken'}
              aria-pressed={isFullscreen}
              className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {isFullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
