'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

type Phase = 'loading' | 'form' | 'error' | 'success' | 'redirecting'

function ActiverenForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [phase, setPhase] = useState<Phase>('loading')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!token) {
      setErrorMessage('Geen activatietoken gevonden in de URL.')
      setPhase('error')
      return
    }

    fetch('/api/activeren/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInviteEmail(data.email ?? '')
          setInviteName(data.name ?? '')
          setPhase('form')
        } else if (data.alreadyUsed) {
          // Link was already used to activate the account — this is not an
          // error state for the user, just send them to /login so they can
          // sign in with the password they already set.
          setPhase('redirecting')
          setTimeout(() => { router.replace('/login') }, 1200)
        } else {
          setErrorMessage(data.error ?? 'Deze activatielink is ongeldig of verlopen.')
          setPhase('error')
        }
      })
      .catch(() => {
        setErrorMessage('Er is een fout opgetreden. Probeer het opnieuw.')
        setPhase('error')
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (password.length < 8) {
      setFormError('Kies een wachtwoord van minstens 8 tekens.')
      return
    }
    if (password !== passwordConfirm) {
      setFormError('De wachtwoorden komen niet overeen.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/activeren/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
      redirect: 'manual',
    })

    // A redirect means success — navigate top-level so the Set-Cookie from
    // the 303 response lands in the document cookie jar (fetch:'follow' drops it).
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
      setPhase('success')
      setTimeout(() => { window.location.href = '/home' }, 800)
      return
    }

    // Non-redirect = error JSON
    let data: { ok: boolean; error?: string } = { ok: false }
    try { data = await res.json() } catch { /* ignore */ }
    setFormError(data.error ?? 'Activatie mislukt. Probeer het opnieuw.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Hero video background */}
      <video
        src="/hero-intro.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(5,5,15,0.72)', zIndex: 1 }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center w-full px-4" style={{ zIndex: 2 }}>
        {/* Logo — same as sidebar */}
        <div className="mb-8 flex flex-col items-center gap-1">
          <Image
            src="/archer-logo.png"
            alt="Archer"
            width={96}
            height={24}
            className="h-6 w-auto brightness-0 invert"
            priority
          />
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            We all have a mind to invest.
          </p>
        </div>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {phase === 'loading' && 'Even geduld\u2026'}
            {phase === 'form' && 'Kies je wachtwoord'}
            {phase === 'error' && 'Link ongeldig'}
            {phase === 'success' && 'Account geactiveerd!'}
            {phase === 'redirecting' && 'Je hebt al een account'}
          </h1>
          {phase === 'form' && (
            <div className="mt-1.5 flex flex-col items-center gap-0.5">
              {inviteName && (
                <p className="text-base font-semibold text-white">{inviteName}</p>
              )}
              {inviteEmail && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{inviteEmail}</p>
              )}
              {!inviteName && !inviteEmail && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Stel je wachtwoord in om te beginnen</p>
              )}
            </div>
          )}
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-2xl p-6 border"
          style={{
            background: 'rgba(15,12,40,0.65)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderColor: 'rgba(255,255,255,0.1)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.55)',
          }}
        >
          {/* Loading */}
          {phase === 'loading' && (
            <div className="flex items-center justify-center py-10">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.12)', borderTopColor: '#2500F5' }}
              />
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
              >
                ✕
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {errorMessage}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Neem contact op via{' '}
                <a
                  href="mailto:info@archerinvest.nl"
                  className="underline"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  info@archerinvest.nl
                </a>
              </p>
            </div>
          )}

          {/* Already used → redirecting to login */}
          {phase === 'redirecting' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.12)', borderTopColor: '#2500F5' }}
              />
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Deze link is al gebruikt om je account te activeren.
                <br />
                Je wordt doorgestuurd naar de inlogpagina&hellip;
              </p>
            </div>
          )}

          {/* Success */}
          {phase === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
              >
                ✓
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Je wordt doorgestuurd naar je dashboard&hellip;
              </p>
            </div>
          )}

          {/* Form */}
          {phase === 'form' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Password field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Wachtwoord
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Minimaal 8 tekens"
                    className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      caretColor: '#fff',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#2500F5'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,0,245,0.2)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Verberg' : 'Toon'}
                  </button>
                </div>
              </div>

              {/* Confirm field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Herhaal wachtwoord
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      caretColor: '#fff',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#2500F5'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,0,245,0.2)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                    tabIndex={-1}
                  >
                    {showConfirm ? 'Verberg' : 'Toon'}
                  </button>
                </div>
              </div>

              {formError && (
                <p
                  className="text-xs rounded-xl px-4 py-2.5 leading-relaxed"
                  style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all mt-1"
                style={{
                  background: loading ? 'rgba(37,0,245,0.5)' : '#2500F5',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(37,0,245,0.4)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Activeren\u2026' : 'Account activeren'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ActiverenPage() {
  return (
    <Suspense>
      <ActiverenForm />
    </Suspense>
  )
}
