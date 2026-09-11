'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import GratisClaimBlock from '@/components/GratisClaimBlock'

let popupTijdensSessieGesloten = false

export default function GratisClaimPopup({ allCoreCompleted }: { allCoreCompleted: boolean }) {
  const [visible, setVisible] = useState(allCoreCompleted && !popupTijdensSessieGesloten)

  function sluiten() {
    popupTijdensSessieGesloten = true
    setVisible(false)
  }

  if (!visible || !allCoreCompleted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm" onClick={sluiten}>
      <div role="dialog" aria-modal="true" aria-labelledby="claim-titel" className="relative w-full max-w-xl rounded-2xl bg-card p-6 shadow-2xl sm:p-8" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={sluiten} className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-opacity hover:opacity-70" aria-label="Sluiten">
          <X size={16} />
        </button>
        <div id="claim-titel" className="sr-only">Claim je gratis Invest-avond</div>
        <GratisClaimBlock variant="popup" />
        <button type="button" onClick={sluiten} className="mt-3 w-full rounded-xl py-2 text-center text-xs text-muted-foreground transition-colors hover:bg-secondary">
          Later doen
        </button>
      </div>
    </div>
  )
}
