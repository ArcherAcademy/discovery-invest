import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/admin/delete-user
 * Permanently deletes a user and all related rows.
 * Body: { userId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  const { userId } = await req.json()
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is verplicht.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Delete all related rows in the correct order (child → parent)
  const deletes = await Promise.all([
    supabase.from('demo_invest_sessions').delete().eq('user_id', userId),
    supabase.from('demo_invest_webhook_log').delete().eq('user_id', userId),
    supabase.from('demo_invest_trigger_log').delete().eq('user_id', userId),
    supabase.from('demo_invest_user_funnel').delete().eq('user_id', userId),
    supabase.from('demo_invest_invites').delete().eq('user_id', userId),
    supabase.from('demo_invest_video_progress').delete().eq('user_id', userId),
  ])

  const firstError = deletes.find(r => r.error)
  if (firstError?.error) {
    console.error('[v0] delete-user: related row deletion failed:', firstError.error.message)
    // Continue anyway — still try to delete the user row itself
  }

  const { error: userError } = await supabase
    .from('demo_invest_users')
    .delete()
    .eq('id', userId)

  if (userError) {
    return NextResponse.json({ error: `Gebruiker verwijderen mislukt: ${userError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
