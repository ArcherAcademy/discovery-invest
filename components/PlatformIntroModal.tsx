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
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="Introductievideo sluiten"
          className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-4 sm:top-4"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="p-6 pb-5 sm:p-8 sm:pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Welkom bij Archer Invest</p>
          <h1 id="platform-intro-title" className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Zo werkt jouw omgeving.
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            Bekijk deze korte video om meteen te weten waar je alles vindt en hoe je jouw traject doorloopt.
          </p>
        </div>

        <div className="bg-foreground px-4 pb-4 sm:px-8 sm:pb-8">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-foreground shadow-lg">
            <iframe
              src="https://player.vimeo.com/video/1230237190?badge=0&autopause=0&player_id=0&app_id=58479"
              title="Introductievideo Archer Invest"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 size-full"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-4 sm:px-8">
          <p className="text-xs text-muted-foreground">Je kunt deze video later terugvinden in je traject.</p>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Naar mijn traject
          </button>
        </div>
      </div>
    </div>
  )
}
