'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, X } from 'lucide-react'
const INTRO_VIDEO_URL = 'https://player.vimeo.com/video/1229085246?dnt=1&title=0&byline=0&portrait=0&autoplay=1&muted=1&playsinline=1'

interface InvestAvondUnlockModalProps {
  open: boolean
  onUnlocked: () => Promise<void> | void
  onClose?: () => void
}

export default function InvestAvondUnlockModal({ open, onUnlocked, onClose }: InvestAvondUnlockModalProps) {
  const router = useRouter()
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleEventClick() {
    if (isUnlocking) return
    setIsUnlocking(true)
    setError(null)

    try {
      const response = await fetch('/api/invest-avond/unlock', {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('unlock_failed')
      await onUnlocked()
      onClose?.()
      router.push('/kennismakingsevent')
    } catch {
      setError('We konden je bonusmateriaal nog niet vrijgeven. Probeer opnieuw.')
    } finally {
      setIsUnlocking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-foreground/55 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invest-avond-unlock-title"
        className="relative my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Pop-up sluiten"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X size={18} />
        </button>

        <div className="aspect-video min-h-0 w-full overflow-hidden bg-foreground">
          <iframe
            src={INTRO_VIDEO_URL}
            title="Wat is een kennismaking event?"
            className="block h-full w-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="flex flex-col gap-4 p-5 sm:gap-5 sm:p-8">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Proficiat</p>
            <h2 id="invest-avond-unlock-title" className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              Je hebt alle 6 video&apos;s bekeken.
            </h2>
            <p className="text-pretty text-sm leading-6 text-muted-foreground">
              Klik op de knop om een kennismakingsevent van ons bij te wonen. Je bonusmateriaal is vrijgegeven.
            </p>
          </div>

          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="button"
            onClick={handleEventClick}
            disabled={isUnlocking}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {isUnlocking ? 'Bonusmateriaal vrijgeven…' : 'Bekijk het kennismaking event'}
            {isUnlocking ? null : <ArrowRight size={17} />}
          </button>

        </div>
      </div>
    </div>
  )
}
