'use client'

import { useEffect } from 'react'

const SESSION_KEY = 'discovery_device_visit_tracked'

function getDeviceType(width: number) {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function DeviceAnalyticsTracker() {
  useEffect(() => {
    if (window.sessionStorage.getItem(SESSION_KEY)) return

    const viewportWidth = window.innerWidth
    const deviceType = getDeviceType(viewportWidth)
    window.sessionStorage.setItem(SESSION_KEY, 'pending')

    fetch('/api/analytics/device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceType, viewportWidth }),
      keepalive: true,
    })
      .then(response => {
        if (!response.ok) throw new Error(`Tracking mislukt met status ${response.status}`)
        window.sessionStorage.setItem(SESSION_KEY, 'done')
      })
      .catch(error => {
        window.sessionStorage.removeItem(SESSION_KEY)
        console.error('[analytics/device] tracking mislukt:', error)
      })
  }, [])

  return null
}
