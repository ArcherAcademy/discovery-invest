import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/admin/webhook-config
 * Upserts a single webhook config row. Requires an active admin session.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  const body = await req.json()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('demo_invest_webhook_config')
    .upsert(body, { onConflict: 'trigger_naam' })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
