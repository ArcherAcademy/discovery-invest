import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runScheduledEvaluator } from '@/lib/scheduled-messages'
import { reconcileHubSpotLeadStages } from '@/lib/hubspot-lead-stage'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const [scheduled, hubspot] = await Promise.allSettled([
    runScheduledEvaluator(supabase, 200),
    reconcileHubSpotLeadStages(supabase),
  ])

  const errors = [scheduled, hubspot]
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason))

  return NextResponse.json({
    ok: errors.length === 0,
    scheduled: scheduled.status === 'fulfilled' ? scheduled.value : null,
    hubspot: hubspot.status === 'fulfilled' ? hubspot.value : null,
    ...(errors.length > 0 ? { errors } : {}),
  }, { status: errors.length === 0 ? 200 : 500 })
}
