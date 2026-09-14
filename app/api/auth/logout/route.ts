import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'local' })

  if (error) {
    console.error('[v0] logout: Supabase-sessie beëindigen gefaald:', error.message)
    return NextResponse.json({ ok: false, error: 'Uitloggen mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
