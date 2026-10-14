import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const DEVICE_TYPES = new Set(['mobile', 'tablet', 'desktop'])

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const deviceType = typeof body?.deviceType === 'string' ? body.deviceType : ''
  const viewportWidth = Number.isInteger(body?.viewportWidth) ? body.viewportWidth : null

  if (!DEVICE_TYPES.has(deviceType) || viewportWidth === null || viewportWidth < 240 || viewportWidth > 10000) {
    return NextResponse.json({ error: 'Ongeldige toestelgegevens.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('demo_invest_webhook_log').insert({
    user_id: user.id,
    event_type: 'analytics.device_visit',
    response_status: 'tracked',
    payload_json: {
      device_type: deviceType,
      viewport_width: viewportWidth,
    },
  })

  if (error) {
    console.error('[analytics/device] toestel registreren mislukt:', error)
    return NextResponse.json({ error: 'Toestel kon niet worden geregistreerd.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
