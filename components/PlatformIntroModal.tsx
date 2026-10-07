'use client'

import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Maximize2, Pause, Play, X } from 'lucide-react'

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

  async function openFullscreen() {
    try {
      if (playerRef.current?.requestFullscreen) {
        await playerRef.current.requestFullscreen()
      } else if (videoRef.current?.requestFullscreen) {
        await videoRef.current.requestFullscreen()
      }
    } catch (error) {
      console.error('[v0] Introductievideo op volledig scherm openen mislukt:', error)
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
            autoPlay
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

          <div className="absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-2xl border border-border/40 bg-background/85 text-foreground shadow-lg backdrop-blur-md sm:inset-x-4 sm:bottom-4">
            <div
              role="progressbar"
              aria-label="Voortgang van de introductievideo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              className="h-1.5 w-full bg-secondary"
            >
              <div
                className="h-full w-full origin-left bg-primary will-change-transform"
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </div>
            <div className="flex items-center justify-between p-1.5">
              <button
                type="button"
                onClick={togglePlayback}
                aria-label={isPlaying ? 'Introductievideo pauzeren' : 'Introductievideo afspelen'}
                className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {isPlaying ? <Pause className="size-5 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={openFullscreen}
                aria-label="Introductievideo op volledig scherm bekijken"
                className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Maximize2 className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
