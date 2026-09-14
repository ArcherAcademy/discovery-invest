import { NextRequest, NextResponse } from 'next/server'
import { parseAuthMarker, requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/admin/delete-user
 * Verwijdert een gebruiker en alle gekoppelde gegevens permanent.
 * Body: { userId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }

  const { userId } = await req.json()
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is verplicht.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('demo_invest_users')
    .select('password_hash')
    .eq('id', userId)
    .maybeSingle()

  const authUserId = parseAuthMarker(profile?.password_hash)
  if (authUserId) {
    const { error: authError } = await supabase.auth.admin.deleteUser(authUserId)
    if (authError) {
      console.error('[v0] delete-user: Supabase Auth-gebruiker verwijderen gefaald:', authError.message)
      return NextResponse.json({ error: 'Authenticatieaccount verwijderen mislukt.' }, { status: 500 })
    }
  }

  const deletes = await Promise.all([
    supabase.from('demo_invest_webhook_log').delete().eq('user_id', userId),
    supabase.from('demo_invest_trigger_log').delete().eq('user_id', userId),
    supabase.from('demo_invest_user_funnel').delete().eq('user_id', userId),
    supabase.from('demo_invest_invites').delete().eq('user_id', userId),
    supabase.from('demo_invest_video_progress').delete().eq('user_id', userId),
  ])

  const firstError = deletes.find(result => result.error)
  if (firstError?.error) {
    console.error('[v0] delete-user: gekoppelde gegevens verwijderen gefaald:', firstError.error.message)
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
