'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const INTRO_COOKIE = 'archer_platform_intro_seen'

export default function PlatformIntroModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const hasSeenIntro = document.cookie
      .split('; ')
      .some(cookie => cookie.startsWith(`${INTRO_COOKIE}=`))

    if (!hasSeenIntro) setOpen(true)
  }, [])

  function close() {
    document.cookie = `${INTRO_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax`
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
      <div className="relative w-full max-w-4xl overflow-hidden rounded-lg bg-foreground shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="Introductievideo sluiten"
          className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-foreground/55 text-primary-foreground/80 backdrop-blur-sm transition-colors hover:bg-foreground/80 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
        >
          <X size={17} aria-hidden="true" />
        </button>

        <div className="relative aspect-video overflow-hidden">
          <iframe
            src="https://player.vimeo.com/video/1230237190?badge=0&autopause=0&player_id=0&app_id=58479"
            title="Introductievideo Archer Invest"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        </div>
      </div>
    </div>
  )
}
