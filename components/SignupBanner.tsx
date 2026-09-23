'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SignupBanner() {
  const pathname = usePathname()

  if (pathname === '/masterclass') return null

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
        <Link
          href="/masterclass"
          className="signup-banner-cta inline-flex shrink-0 items-center rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
        >
          Schrijf je in
        </Link>
      </div>
    </div>
  )
}
