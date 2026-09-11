'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react'

const LS_KEY = 'archer_gratis_popup_seen'
const KORTINGSCODE = 'Free-discovery-invest'
const EVENTBRITE_URL =
  'https://www.eventbrite.be/e/krijg-grip-op-je-geld-en-de-handvatten-om-het-te-laten-groeien-tickets-1995064585882?aff=oddtdtcreator&utm_source=archer&utm_medium=event-page&utm_campaign=content-network'

/**
 * One-time modal that fires when the user has completed all 6 core videos.
 * Dismissed state persists in localStorage — never shown again after closing.
 */
export default function GratisClaimPopup({ allCoreCompleted }: { allCoreCompleted: boolean }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!allCoreCompleted) return
    try {
      if (localStorage.getItem(LS_KEY)) return
    } catch {
      return
    }
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [allCoreCompleted])

  function dismiss() {
    try { localStorage.setItem(LS_KEY, '1') } catch { /* ignore */ }
    setVisible(false)
  }

  function copyCode() {
    navigator.clipboard.writeText(KORTINGSCODE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,10,20,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl px-7 py-7"
        style={{ background: '#fff', boxShadow: '0 24px 80px rgba(8,10,20,0.22)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#f0f3fb]"
          aria-label="Sluiten"
        >
          <X size={15} style={{ color: 'rgba(13,15,20,0.45)' }} />
        </button>

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(37,0,245,0.08)' }}
        >
          <CheckCircle2 size={24} style={{ color: '#2500F5' }} />
        </div>

        <p className="text-xs font-bold tracking-[0.15em] mb-1" style={{ color: '#2500F5' }}>
          VRIJGESPEELD
        </p>
        <h2 className="text-xl font-extrabold mb-2 text-balance" style={{ color: '#0d0f14' }}>
          Proficiat, je hebt een gratis plek verdiend.
        </h2>
        <p className="text-sm mb-5" style={{ color: 'rgba(13,15,20,0.55)', lineHeight: 1.55 }}>
          Gebruik deze kortingscode op Eventbrite om je ticket gratis te maken. De code is <strong style={{ color: '#0d0f14' }}>eenmalig</strong> geldig.
        </p>

        {/* Code block — stacks on mobile so the code never wraps mid-word against the button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
          <div
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl font-mono text-sm font-bold tracking-wide select-all whitespace-nowrap overflow-x-auto"
            style={{ background: '#f0f3fb', border: '1.5px solid rgba(37,0,245,0.2)', color: '#2500F5' }}
          >
            {KORTINGSCODE}
          </div>
          <button
            onClick={copyCode}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all"
            style={{
              background: copied ? 'rgba(37,0,245,0.08)' : '#f0f3fb',
              color: copied ? '#2500F5' : '#0d0f14',
              border: '1.5px solid',
              borderColor: copied ? 'rgba(37,0,245,0.2)' : '#e8ecf4',
            }}
            aria-label="Kopieer code"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Gekopieerd' : 'Kopieer'}
          </button>
        </div>

        <a
          href={EVENTBRITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: '#2500F5', color: '#fff' }}
        >
          Reserveer je gratis plaats
          <ExternalLink size={13} />
        </a>

        <button
          onClick={dismiss}
          className="mt-3 w-full text-center text-xs py-2 rounded-xl transition-colors hover:bg-[#f0f3fb]"
          style={{ color: 'rgba(13,15,20,0.4)' }}
        >
          Later doen
        </button>
      </div>
    </div>
  )
}
