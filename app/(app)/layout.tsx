import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { AppProvider } from '@/components/app-context'
import { AppLayoutShell } from '@/components/AppLayoutShell'
import { DeviceAnalyticsTracker } from '@/components/DeviceAnalyticsTracker'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <AppProvider initialUser={user}>
      <DeviceAnalyticsTracker />
      <AppLayoutShell>{children}</AppLayoutShell>
    </AppProvider>
  )
}
