'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const INTRO_COOKIE_PREFIX = 'archer_platform_intro_seen'

interface PlatformIntroModalProps {
  accountKey: string | null
  isNewAccount: boolean
}

export default function PlatformIntroModal({ accountKey, isNewAccount }: PlatformIntroModalProps) {
  const [open, setOpen] = useState(false)
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

  function close() {
    if (cookieName) {
      document.cookie = `${cookieName}=1; Max-Age=31536000; Path=/; SameSite=Lax`
    }
    setOpen(false)
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

        <div className="relative aspect-video overflow-hidden rounded-2xl bg-transparent">
          <video
            src="/platform-intro-subtitles.mp4"
            aria-label="Introductievideo met ondertitels"
            autoPlay
            controls
            playsInline
            className="absolute inset-0 size-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}
