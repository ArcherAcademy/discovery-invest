'use client'

import { track } from '@vercel/analytics'
import { LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const MASTERCLASS_ORIGIN = 'https://archerinvest.be'
const MASTERCLASS_URL = `${MASTERCLASS_ORIGIN}/masterclass-beslissing-test?embed=1`

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
}

function getEditionId(preferredEdition: string) {
  const normalizedEdition = preferredEdition.trim().toLocaleLowerCase('nl-BE')
  const directEditionId = Object.values(EDITION_IDS).find(editionId => editionId === normalizedEdition)
  if (directEditionId) return directEditionId

  const entry = Object.entries(EDITION_IDS).find(([label]) => normalizedEdition.includes(label))
  return entry?.[1] ?? null
}

export default function MasterclassEmbed({ onSubmitted }: MasterclassEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const submissionInProgress = useRef(false)
  const [loaded, setLoaded] = useState(false)

  const sendResult = useCallback((success: boolean, message: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'archer:masterclass-signup-result', success, message },
      MASTERCLASS_ORIGIN,
    )
  }, [])

  const submitEdition = useCallback(async (preferredEdition: string, source: 'embed' | 'redirect') => {
    if (submissionInProgress.current) return

    const editionId = getEditionId(preferredEdition)
    if (!editionId) {
      sendResult(false, 'Kies een geldige editie en probeer het opnieuw.')
      return
    }

    submissionInProgress.current = true
    track('Embedded masterclass submit gestart', { edition: editionId, source })

    try {
      const response = await fetch('/api/invest-avond/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition: editionId }),
      })

      if (!response.ok) throw new Error('submission_failed')

      sendResult(true, 'Je inschrijving is succesvol doorgestuurd. Je kunt indien nodig nog een andere editie kiezen.')
      track('Embedded masterclass submit voltooid', { edition: editionId, source })
      window.history.replaceState(window.history.state, '', '/masterclass')
      submissionInProgress.current = false
      void Promise.resolve(onSubmitted()).catch(() => undefined)
    } catch {
      submissionInProgress.current = false
      sendResult(false, 'Versturen is niet gelukt. Probeer het opnieuw.')
      track('Embedded masterclass submit mislukt', { edition: editionId, source })
    }
  }, [onSubmitted, sendResult])

  useEffect(() => {
    const handleMessage = (event: MessageEvent<MasterclassMessage>) => {
      if (event.origin !== MASTERCLASS_ORIGIN || event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type !== 'archer:masterclass-signup') return

      const preferredEdition = event.data.preferredEdition
      if (typeof preferredEdition !== 'string') {
        sendResult(false, 'Kies een geldige editie en probeer het opnieuw.')
        return
      }

      void submitEdition(preferredEdition, 'embed')
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sendResult, submitEdition])

  useEffect(() => {
    if (!loaded) return

    const preferredEdition = new URLSearchParams(window.location.search).get('editie')
    if (preferredEdition) void submitEdition(preferredEdition, 'redirect')
  }, [loaded, submitEdition])

  return (
    <section className="absolute inset-0 overflow-hidden rounded-2xl bg-background font-sans text-foreground" aria-labelledby="masterclass-page-title">
      <h1 id="masterclass-page-title" className="sr-only">
        Kies je Invest Masterclass-editie
      </h1>
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
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
        className="block size-full border-0 bg-background transition-opacity duration-200"
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </section>
  )
}
