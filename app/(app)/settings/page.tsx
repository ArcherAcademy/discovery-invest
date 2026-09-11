'use client'

import { useState } from 'react'
import { useApp } from '@/components/app-context'

export default function SettingsPage() {
  const { user, refresh } = useApp()
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp_opt_in ?? false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp_opt_in: whatsapp }),
    })
    await refresh()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: '#0d0f14' }}>Instellingen</h1>

      <div className="p-5 rounded-2xl border space-y-4" style={{ background: '#ffffff', borderColor: '#e8ecf4' }}>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#0d0f14' }}>E-mailadres</label>
          <p className="text-sm" style={{ color: 'rgba(13,15,20,0.55)' }}>{user?.email}</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium" style={{ color: '#0d0f14' }}>WhatsApp notificaties</label>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(13,15,20,0.45)' }}>
              Ontvang herinneringen via WhatsApp
            </p>
          </div>
          <button
            onClick={() => setWhatsapp(v => !v)}
            className="w-11 h-6 rounded-full transition-all relative"
            style={{ background: whatsapp ? '#2500F5' : '#e8ecf4' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: whatsapp ? '22px' : '2px' }}
            />
          </button>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ background: '#2500F5' }}
        >
          {saved ? 'Opgeslagen!' : 'Opslaan'}
        </button>
      </div>
    </div>
  )
}
