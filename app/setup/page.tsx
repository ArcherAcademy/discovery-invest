'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'manual'>('idle')
  const [message, setMessage] = useState('')

  async function runSetup() {
    setStatus('loading')
    try {
      const res = await fetch('/api/setup-db', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setStatus('done')
        setMessage(data.message)
      } else {
        setStatus('manual')
        setMessage(data.message)
      }
    } catch {
      setStatus('manual')
      setMessage('Kon de setup niet uitvoeren. Voer de SQL handmatig uit via het Supabase SQL Editor.')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0a0c12' }}
    >
      <div className="w-full max-w-lg mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xl mb-4"
            style={{ background: '#2500F5' }}
          >
            A
          </div>
          <h1 className="text-xl font-bold text-white">Archer Invest: Database Setup</h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'rgba(240,242,248,0.45)' }}>
            Maak de demo_invest_ tabellen aan in je Supabase project
          </p>
        </div>

        <div
          className="rounded-2xl p-6 border space-y-5"
          style={{ background: '#1a1f2e', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {status === 'idle' && (
            <>
              <div className="space-y-2 text-sm" style={{ color: 'rgba(240,242,248,0.65)' }}>
                <p>Dit maakt de volgende tabellen aan (met RLS):</p>
                <ul className="space-y-1 pl-4" style={{ listStyle: 'disc' }}>
                  {['demo_invest_users', 'demo_invest_videos', 'demo_invest_video_progress', 'demo_invest_user_funnel', 'demo_invest_events', 'demo_invest_event_bookings', 'demo_invest_webhook_log'].map(t => (
                    <li key={t} className="font-mono text-xs" style={{ color: '#2500F5' }}>{t}</li>
                  ))}
                </ul>
                <p className="text-xs pt-1" style={{ color: 'rgba(240,242,248,0.4)' }}>
                  Bestaande tabellen worden nooit aangeraakt. IF NOT EXISTS is van toepassing overal.
                </p>
              </div>
              <button
                onClick={runSetup}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
                style={{ background: '#2500F5' }}
              >
                Database instellen
              </button>
            </>
          )}

          {status === 'loading' && (
            <div className="text-center py-4">
              <p className="text-sm" style={{ color: 'rgba(240,242,248,0.6)' }}>Bezig met instellen...</p>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(37,0,245,0.15)', border: '1px solid rgba(37,0,245,0.3)' }}
              >
                <span className="text-sm font-semibold text-white">Database succesvol ingesteld</span>
              </div>
              <p className="text-xs" style={{ color: 'rgba(240,242,248,0.5)' }}>{message}</p>
              <Link
                href="/login"
                className="block w-full rounded-xl py-2.5 text-sm font-semibold text-white text-center transition-all"
                style={{ background: '#2500F5' }}
              >
                Naar inloggen
              </Link>
            </div>
          )}

          {status === 'manual' && (
            <div className="space-y-4">
              <div
                className="p-3 rounded-xl"
                style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>Handmatige stap vereist</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(240,242,248,0.6)' }}>{message}</p>
              </div>

              <div className="text-sm space-y-2" style={{ color: 'rgba(240,242,248,0.6)' }}>
                <p className="font-semibold text-white">Stappen:</p>
                <ol className="space-y-1.5 pl-4" style={{ listStyle: 'decimal' }}>
                  <li>Ga naar <a href="https://supabase.com/dashboard/project/pgajmjeicrwxthkwwiei/sql" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#2500F5' }}>Supabase SQL Editor</a></li>
                  <li>Open het bestand <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: '#2500F5' }}>supabase/seed.sql</code> uit dit project</li>
                  <li>Plak de inhoud in de SQL Editor en klik Run</li>
                  <li>Kom terug en log in</li>
                </ol>
              </div>

              <Link
                href="/login"
                className="block w-full rounded-xl py-2.5 text-sm font-semibold text-white text-center transition-all"
                style={{ background: '#2500F5' }}
              >
                Toch inloggen
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
