'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    let data: { ok: boolean; error?: string } = { ok: false }
    try { data = await res.json() } catch { /* ignore */ }

    if (res.ok && data.ok) {
      window.location.assign('/home')
      return
    }

    setLoading(false)
    setError(data.error ?? 'Inloggen mislukt.')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">

      {/* Background video — muted + loop, autoPlay works in all modern browsers */}
      <video
        src="/login-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(4,4,12,0.68)', zIndex: 1 }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center w-full px-4" style={{ zIndex: 2 }}>

        {/* Logo + tagline only */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Image
            src="/archer-logo.png"
            alt="Archer"
            width={140}
            height={36}
            className="h-9 w-auto brightness-0 invert"
            priority
          />
          <p className="text-xs tracking-widest uppercase font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
            We all have a mind to invest.
          </p>
        </div>

        {/* Glass card */}
        <div
          className="w-full max-w-sm rounded-2xl p-6 border"
          style={{
            background: 'rgba(60,50,130,0.35)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
          }}
        >
          <form onSubmit={handleLogin} className="flex flex-col gap-4" suppressHydrationWarning>

            {/* Email */}
            <div className="flex flex-col gap-1.5" suppressHydrationWarning>
              <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                E-mailadres
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="naam@voorbeeld.nl"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  caretColor: '#fff',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2500F5'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,0,245,0.2)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5" suppressHydrationWarning>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  Wachtwoord
                </label>
                <a
                  href="#"
                  className="text-sm transition-colors"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                >
                  Vergeten?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  caretColor: '#fff',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2500F5'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,0,245,0.2)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {error && (
              <p
                className="text-xs rounded-xl px-4 py-2.5"
                style={{ color: '#f87171', background: 'rgba(248,113,113,0.12)' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all mt-1"
              style={{
                background: loading ? 'rgba(37,0,245,0.6)' : '#2500F5',
                boxShadow: loading ? 'none' : '0 4px 24px rgba(37,0,245,0.4)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#1a00cc' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#2500F5' }}
            >
              {loading ? 'Inloggen...' : 'Inloggen'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <span className="text-xs tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              ARCHER INVEST
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
          </div>

          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Geen toegang?{' '}
            <a
              href="mailto:finance@archer.finance"
              className="font-semibold transition-colors"
              style={{ color: 'rgba(255,255,255,0.8)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            >
              Neem contact op
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
