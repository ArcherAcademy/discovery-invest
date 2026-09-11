'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
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

export function AppProvider({ children, initialUser }: AppProviderProps) {
  const [user, setUser] = useState<DemoUser | null>(initialUser)
  const [funnel, setFunnel] = useState<DemoUserFunnel | null>(null)
  const [progress, setProgress] = useState<DemoVideoProgress[]>([])
  const [videos, setVideos] = useState<DemoVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [locale, setLocale] = useState<Locale>((initialUser.locale as Locale) ?? 'nl')

  /**
   * Fetch all user data from the server.
   * Identity comes from the httpOnly session cookie — no client-side user_id needed.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (res.status === 401) {
        // Session expired — redirect to login
        window.location.href = '/login'
        return
      }
      if (!res.ok) return

      const data = await res.json()

      if (data.user) {
        setUser(data.user as DemoUser)
        setLocale((data.user.locale as Locale) ?? 'nl')
      }
      if (data.funnel !== undefined) setFunnel(data.funnel as DemoUserFunnel | null)
      if (data.progress) setProgress(data.progress as DemoVideoProgress[])
      if (data.videos) setVideos(data.videos as DemoVideo[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

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
