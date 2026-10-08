'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { ExpiredTrialBanner } from '@/components/ExpiredTrialBanner'
import { SignupBanner } from '@/components/SignupBanner'
import { cn } from '@/lib/utils'

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMasterclass = pathname === '/masterclass'
  const isDashboard = pathname === '/home'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {!isMasterclass ? <Sidebar /> : null}
      <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', !isMasterclass && 'pb-24 sm:pb-0')}>
        {!isMasterclass ? (
          <>
            <ExpiredTrialBanner />
            <SignupBanner />
          </>
        ) : null}
        <main className={cn('relative flex-1 overflow-y-auto', !isMasterclass && 'p-4 sm:p-6')}>
          {isDashboard ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <Image
                src="/images/dashboard-background.png"
                alt=""
                fill
                priority
                sizes="(max-width: 640px) 100vw, calc(100vw - 16rem)"
                className="object-cover object-top opacity-75"
                style={{ maskImage: 'linear-gradient(to bottom, black 0%, black 62%, transparent 100%)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/35 to-background" />
            </div>
          ) : null}
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  )
}
