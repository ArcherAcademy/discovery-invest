import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/masterclass-intro
 * Markeert dat de ingelogde gebruiker de inschrijfpagina gezien heeft,
 * zodat de eenmalige doorverwijzing niet opnieuw gebeurt.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('demo_invest_users')
    .update({ masterclass_intro_pending: false })
    .eq('id', user.id)

  if (error) {
    console.error('[masterclass-intro] Vlag resetten mislukt:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
