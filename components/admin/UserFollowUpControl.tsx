'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, RefreshCw } from 'lucide-react'

interface UserFollowUpControlProps {
  userId: string
  actief?: boolean
  compact?: boolean
  onChange?: (actief: boolean) => void
}

export function UserFollowUpControl({ userId, actief = true, compact = false, onChange }: UserFollowUpControlProps) {
  const [enabled, setEnabled] = useState(actief)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setEnabled(actief), [actief])

  async function toggle() {
    if (saving) return
    const next = !enabled
    setSaving(true)
    setError(null)
    setEnabled(next)

    try {
      const response = await fetch(`/api/admin/users/${userId}/opvolging`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actief: next }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? 'Opslaan mislukt.')
      onChange?.(next)
    } catch (caught) {
      setEnabled(!next)
      setError(caught instanceof Error ? caught.message : 'Opslaan mislukt.')
    } finally {
      setSaving(false)
    }
  }

  const Icon = enabled ? Bell : BellOff

  return (
    <div className={compact ? 'flex flex-col items-start gap-1' : 'flex flex-col gap-2'}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? 'Automatische opvolging uitschakelen' : 'Automatische opvolging inschakelen'}
        onClick={toggle}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
        style={{
          background: enabled ? 'rgba(37,0,245,0.08)' : '#f0f3fb',
          borderColor: enabled ? 'rgba(37,0,245,0.15)' : '#e8ecf4',
          color: enabled ? '#2500F5' : 'rgba(13,15,20,0.55)',
        }}
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} />}
        {enabled ? 'Opvolging aan' : 'Opvolging uit'}
      </button>
      {error && <span role="alert" className="text-[10px] font-medium" style={{ color: '#ef4444' }}>{error}</span>}
    </div>
  )
}
