'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { ExpiredTrialBanner } from '@/components/ExpiredTrialBanner'
import { SignupBanner } from '@/components/SignupBanner'
import { cn } from '@/lib/utils'

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hasArchitecturalBackground =
    pathname === '/home' ||
    pathname === '/traject' ||
    pathname === '/kennismakingsevent' ||
    pathname === '/masterclass' ||
    pathname === '/events' ||
    pathname.startsWith('/video/')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden pb-24 sm:pb-0">
        <ExpiredTrialBanner />
        <SignupBanner />
        <main
          className={cn(
            'relative flex-1 overflow-y-auto bg-background p-4 sm:p-6',
            hasArchitecturalBackground && 'bg-cover bg-top bg-no-repeat',
          )}
          style={
            hasArchitecturalBackground
              ? {
                  backgroundImage:
                    'linear-gradient(to bottom, rgb(255 255 255 / 0.34), rgb(255 255 255 / 0.58)), url("/images/dashboard-background.png")',
                  backgroundAttachment: 'scroll',
                }
              : undefined
          }
        >
          <div className="relative min-h-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
