import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fireInstant } from '@/lib/workflow-engine'

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await req.json()
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // ── 1. Fetch existing progress row ─────────────────────────────────────────
  const { data: existing } = await supabase
    .from('demo_invest_video_progress')
    .select('started_at, status')
    .eq('user_id', authUser.id)
    .eq('video_id', videoId)
    .maybeSingle()

  // ── 2. Upsert completed row ────────────────────────────────────────────────
  const { data: row, error: progressError } = await supabase
    .from('demo_invest_video_progress')
    .upsert({
      user_id: authUser.id,
      video_id: videoId,
      status: 'completed',
      progress_pct: 100,
      started_at: existing?.started_at ?? now,
      completed_at: now,
      last_activity_at: now,
    }, { onConflict: 'user_id,video_id' })
    .select()
    .single()

  if (progressError) {
    console.error('[video-complete] progress upsert failed:', progressError)
    return NextResponse.json({ error: progressError.message }, { status: 500 })
  }

  // ── 3. Recount completed core videos ──────────────────────────────────────
  const { data: coreVideos, error: coreErr } = await supabase
    .from('demo_invest_videos')
    .select('id')
    .eq('section', 'core')

  if (coreErr) {
    console.error('[video-complete] core videos fetch failed:', coreErr)
    return NextResponse.json({ error: coreErr.message }, { status: 500 })
  }

  const coreIds = (coreVideos ?? []).map((v: { id: string }) => v.id)

  const { data: completedRows, error: countErr } = await supabase
    .from('demo_invest_video_progress')
    .select('video_id')
    .eq('user_id', authUser.id)
    .eq('status', 'completed')
    .in('video_id', coreIds)

  if (countErr) {
    console.error('[video-complete] completed count failed:', countErr)
    return NextResponse.json({ error: countErr.message }, { status: 500 })
  }

  const videosCompletedCount = (completedRows ?? []).length
  const allCompleted = videosCompletedCount >= 6

  // ── 4. Read current funnel to check if all_completed_at is already set ─────
  const { data: existingFunnel } = await supabase
    .from('demo_invest_user_funnel')
    .select('all_completed_at')
    .eq('user_id', authUser.id)
    .maybeSingle()

  const justCompleted = allCompleted && !existingFunnel?.all_completed_at

  // ── 5. Update funnel — NON-SILENT ─────────────────────────────────────────
  const funnelUpdate: Record<string, unknown> = {
    user_id: authUser.id,
    videos_completed_count: videosCompletedCount,
    last_video_watched_at: now,
    last_activity_at: now,
    updated_at: now,
  }
  // Only set all_completed_at the FIRST time (idempotent)
  if (justCompleted) {
    funnelUpdate.all_completed_at = now
  }

  const { error: funnelError } = await supabase
    .from('demo_invest_user_funnel')
    .upsert(funnelUpdate, { onConflict: 'user_id' })

  if (funnelError) {
    // Log full details and return error — never silently swallow this
    console.error('[video-complete] FUNNEL UPSERT FAILED:', JSON.stringify(funnelError))
    return NextResponse.json({
      error: 'funnel_update_failed',
      detail: funnelError.message,
      hint: funnelError.hint ?? null,
      code: funnelError.code ?? null,
    }, { status: 500 })
  }

  console.log(`[video-complete] funnel updated: user=${authUser.id} count=${videosCompletedCount} justCompleted=${justCompleted}`)

  // ── 6. Fire mail_10_alles_gezien — only when all_completed_at just set ────
  if (justCompleted) {
    try {
      const firedNamen = new Set<string>()
      await fireInstant(supabase, 'alles_gezien_c1', authUser, firedNamen)
      console.log(`[video-complete] mail_10_alles_gezien fired for user=${authUser.id}`)
    } catch (triggerErr) {
      // Log but don't fail the response — video is still marked complete
      console.error('[video-complete] mail_10 trigger failed:', triggerErr)
    }
  }

  return NextResponse.json({
    ok: true,
    row,
    videosCompletedCount,
    allCompleted,
    justCompleted,
  })
}
