'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import useSWR from 'swr'
import type { DemoUser, DemoUserFunnel, DemoVideoProgress, DemoVideo } from '@/lib/types'
import type { Locale } from '@/lib/i18n'
import { hasPermanentAccess, isTrialExpired } from '@/lib/access'

interface AppContextValue {
  user: DemoUser | null
  funnel: DemoUserFunnel | null
  progress: DemoVideoProgress[]
  videos: DemoVideo[]
  loading: boolean
  locale: Locale
  setLocale: (l: Locale) => void
  refresh: () => Promise<void>
  trialDaysLeft: number
  trialHoursLeft: number
  isExpired: boolean
  isAdminOrMentor: boolean
  coreCompleted: number
  allCoreCompleted: boolean
  investAvondGeclaimd: boolean
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

interface AppProviderProps {
  children: ReactNode
  /** Pre-loaded from server-side session check in layout.tsx */
  initialUser: DemoUser
}

interface AppData {
  user: DemoUser
  funnel: DemoUserFunnel | null
  progress: DemoVideoProgress[]
  videos: DemoVideo[]
}

async function fetchAppData(url: string): Promise<AppData> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'include' })

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('Sessie verlopen')
  }
  if (!response.ok) throw new Error(`Appgegevens laden mislukt (${response.status})`)

  return response.json() as Promise<AppData>
}

export function AppProvider({ children, initialUser }: AppProviderProps) {
  const [locale, setLocale] = useState<Locale>((initialUser.locale as Locale) ?? 'nl')
  const { data, isLoading, mutate } = useSWR<AppData>('/api/me', fetchAppData, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1_000,
  })

  const user = data?.user ?? initialUser
  const funnel = data?.funnel ?? null
  const progress = data?.progress ?? []
  const videos = data?.videos ?? []
  const loading = isLoading && !data

  useEffect(() => {
    if (data?.user) setLocale((data.user.locale as Locale) ?? 'nl')
  }, [data?.user])

  /**
   * SWR houdt gelijktijdige herlaadacties in de juiste volgorde, zodat een oudere
   * response een net opgeslagen videovoltooiing niet meer kan overschrijven.
   */
  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  // Toegang is rolgebaseerd en live: admin en mentor verlopen nooit, ongeacht
  // trial_expires_at. Zie lib/access.ts — één bron van waarheid.
  const isAdminOrMentor = hasPermanentAccess(user?.role)
  const now = new Date()
  const trialExpires = user?.trial_expires_at ? new Date(user.trial_expires_at) : null
  const trialMsLeft = trialExpires ? trialExpires.getTime() - now.getTime() : 0
  const trialDaysLeft = isAdminOrMentor ? Infinity : (trialExpires ? Math.max(0, Math.ceil(trialMsLeft / (1000 * 60 * 60 * 24))) : 0)
  const trialHoursLeft = isAdminOrMentor ? Infinity : (trialExpires ? Math.max(0, Math.ceil(trialMsLeft / (1000 * 60 * 60))) : 0)
  const isExpired = isTrialExpired(user, now)
  // Derive from live progress array — always in sync with the vinkjes in the sidebar
  const coreVideoIds = new Set(videos.filter(v => v.section === 'core').map(v => v.id))
  const coreCompleted = progress.filter(p => coreVideoIds.has(p.video_id) && p.status === 'completed').length
  const allCoreCompleted = coreCompleted >= 6
  const investAvondGeclaimd = funnel?.invest_avond_geclaimd ?? false

  return (
    <AppContext.Provider value={{
      user, funnel, progress, videos, loading, locale, setLocale,
      refresh, trialDaysLeft, trialHoursLeft, isExpired, isAdminOrMentor,
      coreCompleted, allCoreCompleted, investAvondGeclaimd,
    }}>
      {children}
    </AppContext.Provider>
  )
}
