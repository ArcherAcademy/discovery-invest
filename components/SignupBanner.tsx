'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SignupBanner() {
  const pathname = usePathname()

  if (pathname === '/masterclass') return null

  return (
    <div className="relative z-30 border-b border-primary/10 bg-background/80 px-4 py-2 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-6xl justify-end">
        <Link
          href="/masterclass"
          className="signup-banner-cta inline-flex items-center rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
        >
          Schrijf je in
        </Link>
      </div>
    </div>
  )
}
