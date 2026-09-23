'use client'

import Link from 'next/link'

export function SignupBanner() {
  return (
    <div className="relative z-30 border-b border-primary/10 bg-primary/[0.035] px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-xs sm:text-sm">
        <p className="flex min-w-0 items-center gap-2 leading-5 text-foreground/70">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate sm:overflow-visible sm:text-clip">
            <strong className="font-semibold text-foreground">Wachtlijst februari 2027 is geopend.</strong>{' '}
            <span className="hidden text-muted-foreground sm:inline">Beperkt aantal plaatsen.</span>
          </span>
        </p>
        <Link
          href="/masterclass"
          className="signup-focus-ring group relative inline-flex shrink-0 items-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Schrijf je in
        </Link>
      </div>
    </div>
  )
}
