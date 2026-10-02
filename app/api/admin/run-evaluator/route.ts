import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { runEvaluator } from '@/lib/workflow-engine'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()
  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'
  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? 10)
  const candidateLimit = dryRun && Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(Math.trunc(requestedLimit), 25))
    : 250

  try {
    const result = await runEvaluator(supabase, { dryRun, candidateLimit })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
