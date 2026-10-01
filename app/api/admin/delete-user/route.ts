import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const USER_DATA_TABLES = [
  'demo_invest_sessions',
  'demo_invest_webhook_log',
  'demo_invest_trigger_log',
  'demo_invest_trigger_delivery',
  'demo_invest_trigger_sent',
  'demo_invest_user_funnel',
  'demo_invest_invites',
  'demo_invest_video_progress',
  'demo_invest_event_bookings',
  'demo_invest_quiz_submissions',
  'demo_invest_vermogensscan',
] as const

/**
 * DELETE /api/admin/delete-user
 * Verwijdert een gebruiker permanent uit Supabase Auth en alle app-tabellen.
 * Body: { userId: string }
 */
export async function DELETE(req: NextRequest) {
  let actor
  try {
    actor = await requireAdminOrMentor(req)
  } catch (err) {
    const forbidden = err instanceof Error && err.message === 'Forbidden'
    return NextResponse.json(
      { error: forbidden ? 'Je hebt geen rechten om gebruikers te verwijderen.' : 'Je sessie is verlopen. Log opnieuw in.' },
      { status: forbidden ? 403 : 401 },
    )
  }

  const body = await req.json().catch(() => null)
  const userId = body?.userId
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Geen geldige gebruiker geselecteerd.' }, { status: 400 })
  }
  if (userId === actor.id) {
    return NextResponse.json({ error: 'Je kunt je eigen account hier niet verwijderen.' }, { status: 409 })
  }

  const supabase = createAdminClient()
  const { data: target, error: targetError } = await supabase
    .from('demo_invest_users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) {
    console.error('[v0] delete-user: target lookup failed:', targetError.message)
    return NextResponse.json({ error: 'De gebruiker kon niet worden gecontroleerd. Probeer opnieuw.' }, { status: 500 })
  }
  if (!target) {
    return NextResponse.json({ error: 'Deze gebruiker bestaat niet meer.' }, { status: 404 })
  }
  if (actor.role === 'mentor' && target.role !== 'user') {
    return NextResponse.json({ error: 'Alleen een admin kan een mentor of admin verwijderen.' }, { status: 403 })
  }

  const deletionResults = await Promise.all(
    USER_DATA_TABLES.map(async table => ({
      table,
      result: await supabase.from(table).delete().eq('user_id', userId),
    })),
  )
  const failedDeletion = deletionResults.find(({ result }) => result.error)
  if (failedDeletion?.result.error) {
    console.error(
      `[v0] delete-user: deletion from ${failedDeletion.table} failed:`,
      failedDeletion.result.error.message,
    )
    return NextResponse.json({ error: 'Niet alle gekoppelde gegevens konden worden verwijderd. Probeer opnieuw.' }, { status: 500 })
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(userId)
  if (authError) {
    console.error('[v0] delete-user: Supabase Auth deletion failed:', authError.message)
    return NextResponse.json({ error: 'Het account kon niet uit de aanmeldgegevens worden verwijderd. Probeer opnieuw.' }, { status: 500 })
  }

  // De FK vanuit demo_invest_users hoort via ON DELETE CASCADE mee te gaan.
  // Deze delete maakt de route ook robuust voor oudere records zonder auth-relatie.
  const { error: profileError } = await supabase
    .from('demo_invest_users')
    .delete()
    .eq('id', userId)

  if (profileError) {
    console.error('[v0] delete-user: profile cleanup failed:', profileError.message)
    return NextResponse.json({ error: 'Het account is verwijderd, maar de profielopruiming is niet volledig gelukt.' }, { status: 500 })
  }

  const { data: remainingUser, error: verificationError } = await supabase
    .from('demo_invest_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (verificationError || remainingUser) {
    console.error('[v0] delete-user: deletion verification failed:', verificationError?.message ?? 'user still exists')
    return NextResponse.json({ error: 'De verwijdering kon niet worden bevestigd. Probeer opnieuw.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
