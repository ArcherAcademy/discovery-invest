import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { AppProvider } from '@/components/app-context'
import { Sidebar } from '@/components/sidebar'
import { ExpiredTrialBanner } from '@/components/ExpiredTrialBanner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <AppProvider initialUser={user}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        {/* Op mobiel blijft onderaan ruimte vrij voor de vaste tabnavigatie. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden pb-24 sm:pb-0">
          <ExpiredTrialBanner />
          <main className="relative flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
