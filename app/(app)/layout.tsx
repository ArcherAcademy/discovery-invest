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
        {/* pt-14 reserves space for the fixed mobile topbar (56px); sm+ has no fixed topbar so it's reset to 0 */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden pt-14 sm:pt-0">
          <ExpiredTrialBanner />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
