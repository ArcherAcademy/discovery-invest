'use client'

import { useRouter } from 'next/navigation'
import { useApp } from '@/components/app-context'

export function SignupBanner() {
  const router = useRouter()
  const { allCoreCompleted, investAvondGeclaimd, openInvestAvondPrompt } = useApp()

  if (!allCoreCompleted) return null

  return (
    <div className="relative z-30 border-b border-primary/10 bg-background/80 px-4 py-2 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-xs sm:text-sm">
        <p className="flex min-w-0 items-center gap-2 leading-5 text-muted-foreground">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate">
            <strong className="font-semibold text-foreground">Editie februari 2027</strong>{' '}
            <span>wachtlijst geopend</span>
            <span className="hidden text-foreground/45 sm:inline"> · Beperkt aantal plaatsen</span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            if (investAvondGeclaimd) {
              router.push('/masterclass')
            } else {
              openInvestAvondPrompt('header')
            }
          }}
          className="signup-banner-cta inline-flex shrink-0 items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
        >
          Schrijf je in
        </button>
      </div>
    </div>
  )
}
