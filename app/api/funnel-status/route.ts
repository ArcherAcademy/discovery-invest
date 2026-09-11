import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PATCH /api/funnel-status
 * Admin-only. Toggle invest_avond_geclaimd or invest_avond_verschenen for a user.
 * Body: { user_id: string; field: 'invest_avond_geclaimd' | 'invest_avond_verschenen'; value: boolean }
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  const body = await req.json() as { user_id?: string; field?: string; value?: boolean }
  const { user_id, field, value } = body

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
  }
  if (field !== 'invest_avond_geclaimd' && field !== 'invest_avond_verschenen') {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }
  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: 'value must be boolean' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('demo_invest_user_funnel')
    .update({ [field]: value })
    .eq('user_id', user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
