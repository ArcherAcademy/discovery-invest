'use client'

import { track } from '@vercel/analytics'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const MASTERCLASS_ORIGIN = 'https://archerinvest.be'
const MASTERCLASS_URL = `${MASTERCLASS_ORIGIN}/masterclass-beslissing-test?embed=1`
const MIN_FRAME_HEIGHT = 640
const MAX_FRAME_HEIGHT = 12_000

const EDITION_IDS = {
  'februari 2027': 'februari-2027',
  'juni 2027': 'juni-2027',
  'oktober 2027': 'oktober-2027',
} as const

type MasterclassEmbedProps = {
  onSubmitted: () => void | Promise<void>
}

type MasterclassMessage = {
  type?: unknown
  preferredEdition?: unknown
  height?: unknown
}

function getEditionId(preferredEdition: string) {
  const normalizedEdition = preferredEdition.trim().toLocaleLowerCase('nl-BE')
  const entry = Object.entries(EDITION_IDS).find(([label]) => normalizedEdition.includes(label))
  return entry?.[1] ?? null
}

export default function MasterclassEmbed({ onSubmitted }: MasterclassEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const submissionInProgress = useRef(false)
  const [frameHeight, setFrameHeight] = useState(MIN_FRAME_HEIGHT)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const sendResult = (success: boolean, message: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'archer:masterclass-signup-result', success, message },
        MASTERCLASS_ORIGIN,
      )
    }

    const handleMessage = async (event: MessageEvent<MasterclassMessage>) => {
      if (event.origin !== MASTERCLASS_ORIGIN || event.source !== iframeRef.current?.contentWindow) return

      if (event.data?.type === 'archer:embed-height') {
        const reportedHeight = event.data.height
        if (typeof reportedHeight !== 'number' || !Number.isFinite(reportedHeight)) return
        setFrameHeight(Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.ceil(reportedHeight))))
        return
      }

      if (event.data?.type !== 'archer:masterclass-signup' || submissionInProgress.current) return

      const preferredEdition = event.data.preferredEdition
      const editionId = typeof preferredEdition === 'string' ? getEditionId(preferredEdition) : null
      if (!editionId) {
        sendResult(false, 'Kies een geldige editie en probeer het opnieuw.')
        return
      }

      submissionInProgress.current = true
      track('Embedded masterclass submit gestart', { edition: editionId })

      try {
        const response = await fetch('/api/invest-avond/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ edition: editionId }),
        })

        if (!response.ok) throw new Error('submission_failed')

        sendResult(true, 'Je inschrijving is succesvol doorgestuurd.')
        track('Embedded masterclass submit voltooid', { edition: editionId })
        void Promise.resolve(onSubmitted()).catch(() => undefined)
      } catch {
        submissionInProgress.current = false
        sendResult(false, 'Versturen is niet gelukt. Probeer het opnieuw.')
        track('Embedded masterclass submit mislukt', { edition: editionId })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onSubmitted])

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <h1 className="sr-only">Kies je Invest Masterclass-editie</h1>
      <div className="relative mx-auto w-full max-w-7xl">
        {!loaded ? (
          <div className="absolute inset-x-0 top-0 flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Masterclass laden
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          src={MASTERCLASS_URL}
          title="Kies je Invest Masterclass-editie"
          onLoad={() => setLoaded(true)}
          sandbox="allow-forms allow-same-origin allow-scripts"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="block w-full border-0 bg-background transition-opacity duration-200"
          style={{ height: frameHeight, opacity: loaded ? 1 : 0 }}
        />
      </div>
    </main>
  )
}
