'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export function SignupBanner() {
  return (
    <div className="relative z-30 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs sm:text-sm">
        <p className="flex min-w-0 items-center gap-2 leading-5">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span className="truncate sm:overflow-visible sm:text-clip">
            <strong>Wachtlijst februari 2027 is geopend.</strong>{' '}
            <span className="hidden text-amber-800 sm:inline">Beperkt aantal plaatsen.</span>
          </span>
        </p>
        <Link
          href="/masterclass"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Schrijf je in
          <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </div>
    </div>
  )
}
