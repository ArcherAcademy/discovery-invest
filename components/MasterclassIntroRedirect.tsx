'use client'

import { track } from '@vercel/analytics'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useApp } from '@/components/app-context'

const MASTERCLASS_PATH = '/masterclass'

export function MasterclassIntroRedirect() {
  const { user, refresh } = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const handled = useRef(false)

  const isPending = user?.masterclass_intro_pending === true

  useEffect(() => {
    if (!isPending || handled.current) return

    if (pathname !== MASTERCLASS_PATH) {
      track('Masterclass intro doorverwezen', { from: pathname })
      router.replace(MASTERCLASS_PATH)
      return
    }

    // Eén poging per sessie: ook als het opslaan mislukt, blijft de gebruiker
    // niet in een doorverwijslus hangen.
    handled.current = true
    fetch('/api/masterclass-intro', { method: 'POST', credentials: 'include' })
      .then(response => {
        if (response.ok) return refresh()
      })
      .catch(error => console.error('[masterclass-intro] Markeren mislukt:', error))
  }, [isPending, pathname, router, refresh])

  return null
}
