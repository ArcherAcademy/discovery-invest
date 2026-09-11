'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, Ticket } from 'lucide-react'

const KORTINGSCODE = 'Free-discovery-invest'
const EVENTBRITE_URL =
  'https://www.eventbrite.be/e/krijg-grip-op-je-geld-en-de-handvatten-om-het-te-laten-groeien-tickets-1995064585882?aff=oddtdtcreator&utm_source=archer&utm_medium=event-page&utm_campaign=content-network'

interface GratisClaimBlockProps {
  variant?: 'full' | 'compact'
}

export default function GratisClaimBlock({ variant = 'full' }: GratisClaimBlockProps) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(KORTINGSCODE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  if (variant === 'compact') {
    return (
      <div
        className="px-4 py-4 rounded-xl border flex flex-col gap-3"
        style={{ background: 'rgba(37,0,245,0.04)', borderColor: 'rgba(37,0,245,0.18)' }}
      >
        <div className="flex items-center gap-2">
          <Ticket size={15} style={{ color: '#2500F5' }} />
          <p className="text-sm font-semibold" style={{ color: '#0d0f14' }}>
            Je gratis Invest-avond staat klaar
          </p>
        </div>

        {/* Code row */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 min-w-0 px-3 py-2 rounded-lg font-mono text-sm font-bold tracking-wide select-all whitespace-nowrap overflow-x-auto"
            style={{ background: '#fff', border: '1px solid rgba(37,0,245,0.2)', color: '#2500F5' }}
          >
            {KORTINGSCODE}
          </div>
          <button
            onClick={copyCode}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all hover:scale-105"
            style={{ background: copied ? 'rgba(37,0,245,0.1)' : '#2500F5', color: '#fff' }}
            aria-label="Kopieer code"
          >
            {copied ? <Check size={15} style={{ color: '#2500F5' }} /> : <Copy size={14} />}
          </button>
        </div>

        <p className="text-xs" style={{ color: 'rgba(13,15,20,0.5)' }}>
          Vul deze code in op Eventbrite om je ticket gratis te maken. De code is eenmalig geldig.
        </p>

        <a
          href={EVENTBRITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: '#2500F5', color: '#fff' }}
        >
          Reserveer je gratis plaats
          <ExternalLink size={13} />
        </a>
      </div>
    )
  }

  // Full variant
  return (
    <div
      className="rounded-2xl mb-8 px-7 py-6"
      style={{
        background: 'rgba(37,0,245,0.05)',
        border: '1.5px solid rgba(37,0,245,0.18)',
      }}
    >
      <p className="text-xs font-bold tracking-[0.15em] mb-2" style={{ color: '#2500F5' }}>
        VRIJGESPEELD
      </p>
      <h2 className="text-xl font-extrabold mb-1.5 text-balance" style={{ color: '#0d0f14' }}>
        Proficiat, je gratis Invest-avond staat klaar.
      </h2>
      <p className="text-sm mb-5" style={{ color: 'rgba(13,15,20,0.55)', lineHeight: 1.55 }}>
        Gebruik onderstaande kortingscode op de Eventbrite-pagina om je ticket gratis te maken. De code is <strong style={{ color: '#0d0f14' }}>eenmalig</strong> geldig.
      </p>

      {/* Code block — stacks on mobile so the code never wraps mid-word against the button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-3">
        <div
          className="flex-1 min-w-0 px-4 py-3 rounded-xl font-mono text-base font-bold tracking-wide select-all whitespace-nowrap overflow-x-auto"
          style={{ background: '#fff', border: '1.5px solid rgba(37,0,245,0.25)', color: '#2500F5' }}
        >
          {KORTINGSCODE}
        </div>
        <button
          onClick={copyCode}
          className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold shrink-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-85"
        style={{ background: '#2500F5', color: '#fff' }}
      >
        Reserveer je gratis plaats
        <ExternalLink size={13} />
      </a>
    </div>
  )
}
