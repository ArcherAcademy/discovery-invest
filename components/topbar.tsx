'use client'

import { Bell } from 'lucide-react'
import { useApp } from './app-context'

export function Topbar() {
  const { locale, setLocale } = useApp()

  function toggleLocale() {
    setLocale(locale === 'nl' ? 'en' : 'nl')
  }

  return (
    <header
      className="flex items-center justify-end gap-3 px-6 shrink-0 border-b"
      style={{ height: '73px', background: '#ffffff', borderColor: '#e8ecf4' }}
    >
      {/* Language toggle */}
      <button
        onClick={toggleLocale}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border transition-all"
        style={{
          background: 'rgba(13,15,20,0.04)',
          borderColor: '#e8ecf4',
          color: 'rgba(13,15,20,0.55)',
        }}
      >
        <span style={{ color: locale === 'nl' ? '#0d0f14' : 'rgba(13,15,20,0.35)' }}>NL</span>
        <span style={{ color: 'rgba(13,15,20,0.2)' }}>/</span>
        <span style={{ color: locale === 'en' ? '#0d0f14' : 'rgba(13,15,20,0.35)' }}>EN</span>
      </button>

      {/* Notifications */}
      <button
        className="relative p-1.5 rounded-full transition-colors"
        style={{ color: 'rgba(13,15,20,0.4)' }}
        aria-label="Notifications"
      >
        <Bell size={16} />
      </button>
    </header>
  )
}
