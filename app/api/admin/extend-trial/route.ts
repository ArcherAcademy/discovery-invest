import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { hasPermanentAccess } from '@/lib/access'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, days } = await req.json()
  if (!userId || typeof days !== 'number' || days < 1 || days > 365) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Fetch current trial state
  const { data: user, error: fetchErr } = await supabase
    .from('demo_invest_users')
    .select('role, activated_at, trial_expires_at')
    .eq('id', userId)
    .single()

  if (fetchErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Admin en mentor hebben sowieso onbeperkte toegang op basis van hun rol —
  // een trialdatum zetten heeft daar geen betekenis.
  if (hasPermanentAccess(user.role)) {
    return NextResponse.json(
      { error: 'Dit account heeft al onbeperkte toegang (admin/mentor).' },
      { status: 400 },
    )
  }

  const nowMs = Date.now()
  const currentMs = user.trial_expires_at ? new Date(user.trial_expires_at).getTime() : 0
  // Is de trial al voorbij (of nooit gezet)? Reken vanaf NU, zodat een verlopen
  // account echt weer actief wordt. Loopt hij nog? Tel op bij de vervaldatum.
  const wasExpired = currentMs <= nowMs
  const base = wasExpired ? nowMs : currentMs

  const newExpiry = new Date(base + days * 24 * 60 * 60 * 1000)

  const { error: updateErr } = await supabase
    .from('demo_invest_users')
    .update({ trial_expires_at: newExpiry.toISOString() })
    .eq('id', userId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    new_expires_at: newExpiry.toISOString(),
    // true = heractiveerd vanaf nu, false = verlengd bovenop een lopende trial
    reactivated: wasExpired,
  })
}
