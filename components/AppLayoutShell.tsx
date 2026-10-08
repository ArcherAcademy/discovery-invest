'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { ExpiredTrialBanner } from '@/components/ExpiredTrialBanner'
import { SignupBanner } from '@/components/SignupBanner'
import { cn } from '@/lib/utils'

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMasterclass = pathname === '/masterclass'

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
          {children}
        </main>
      </div>
    </div>
  )
}
