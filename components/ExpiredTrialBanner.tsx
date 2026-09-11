'use client'

import { useApp } from './app-context'

export function ExpiredTrialBanner() {
  const { isExpired, isAdminOrMentor } = useApp()

  if (!isExpired || isAdminOrMentor) return null

  return (
    <div
      className="w-full px-4 sm:px-6 py-3 flex items-center gap-3 text-sm font-medium shrink-0"
      style={{ background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid rgba(239,68,68,0.15)', color: '#dc2626' }}
    >
      <span className="text-base leading-none shrink-0">⚠</span>
      <span className="leading-relaxed">
        Je trial is verlopen. Je kunt de inhoud nog bekijken, maar je toegang is beperkt.
        Neem contact op via{' '}
        <a
          href="mailto:info@archerinvest.be"
          className="underline font-semibold"
          style={{ color: '#dc2626' }}
        >
          info@archerinvest.be
        </a>
        {' '}om je trial te verlengen.
      </span>
    </div>
  )
}
