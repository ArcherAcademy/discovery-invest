import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitEvent } from '@/lib/emit-event'
import { fireInstant } from '@/lib/workflow-engine'
import type { DemoUser, DemoUserFunnel, DemoVideo, DemoVideoProgress } from '@/lib/types'

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createAdminClient()

  const { videoId, action, progressPct } = await req.json() as {
    videoId?: unknown
    action?: unknown
    progressPct?: unknown
  }

  if (typeof videoId !== 'string' || !videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
  }
  if (action !== 'started' && action !== 'progress' && action !== 'completed') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (action === 'progress' && (typeof progressPct !== 'number' || !Number.isFinite(progressPct))) {
    return NextResponse.json({ error: 'Invalid progressPct' }, { status: 400 })
  }

  const safeProgressPct = action === 'progress'
    ? Math.min(99, Math.max(0, Math.round(progressPct as number)))
    : undefined
  const now = new Date()

  // Load user, funnel, video
  const [{ data: userData }, { data: funnelData }, { data: videoData }] = await Promise.all([
    supabase.from('demo_invest_users').select('*').eq('id', authUser.id).single(),
    supabase.from('demo_invest_user_funnel').select('*').eq('user_id', authUser.id).single(),
    supabase.from('demo_invest_videos').select('*').eq('id', videoId).single(),
  ])

  const user = userData as DemoUser
  const funnel = funnelData as DemoUserFunnel
  const video = videoData as DemoVideo

  // Upsert progress row — always upsert so a missing row never silently fails
  const { data: existingProgress } = await supabase
    .from('demo_invest_video_progress')
    .select('*')
    .eq('user_id', authUser.id)
    .eq('video_id', videoId)
    .single()

  let upsertPayload: Partial<DemoVideoProgress> & { user_id: string; video_id: string }

  if (action === 'started') {
    upsertPayload = {
      user_id: authUser.id,
      video_id: videoId,
      status: existingProgress?.status === 'completed' ? 'completed' : 'in_progress',
      started_at: existingProgress?.started_at ?? now.toISOString(),
      progress_pct: existingProgress?.progress_pct ?? 0,
      last_activity_at: now.toISOString(),
    }
  } else if (action === 'progress') {
    // Monotone: progress_pct may never decrease; take the max of incoming and existing
    const existingPct = existingProgress?.progress_pct ?? 0
    const safePct = existingProgress?.status === 'completed'
      ? 100
      : Math.max(safeProgressPct ?? 0, existingPct)

    upsertPayload = {
      user_id: authUser.id,
      video_id: videoId,
      status: existingProgress?.status === 'completed' ? 'completed' : 'in_progress',
      started_at: existingProgress?.started_at ?? now.toISOString(),
      progress_pct: safePct,
      last_activity_at: now.toISOString(),
    }
  } else {
    // completed — idempotent: if already completed, keep existing timestamps
    upsertPayload = {
      user_id: authUser.id,
      video_id: videoId,
      status: 'completed',
      progress_pct: 100,
      started_at: existingProgress?.started_at ?? now.toISOString(),
      completed_at: existingProgress?.completed_at ?? now.toISOString(),
      last_activity_at: now.toISOString(),
    }
  }

  let progressError: { message: string; details?: string | null } | null = null

  if (action === 'completed') {
    const result = await supabase
      .from('demo_invest_video_progress')
      .upsert(upsertPayload, { onConflict: 'user_id,video_id' })
    progressError = result.error
  } else {
    // Een late started/progress-request mag een reeds voltooide video nooit terugzetten.
    const { data: updatedRows, error: updateError } = await supabase
      .from('demo_invest_video_progress')
      .update(upsertPayload)
      .eq('user_id', authUser.id)
      .eq('video_id', videoId)
      .neq('status', 'completed')
      .select('video_id')

    progressError = updateError

    if (!progressError && (updatedRows?.length ?? 0) === 0 && !existingProgress) {
      const insertResult = await supabase
        .from('demo_invest_video_progress')
        .upsert(upsertPayload, {
          onConflict: 'user_id,video_id',
          ignoreDuplicates: true,
        })
      progressError = insertResult.error
    }
  }

  if (progressError) {
    console.error('[v0] video_progress write failed:', progressError.message, progressError.details)
    return NextResponse.json({ error: 'progress_upsert_failed', detail: progressError.message }, { status: 500 })
  }

  // Update last_activity
  const { error: activityError } = await supabase
    .from('demo_invest_users')
    .update({ last_activity_at: now.toISOString() })
    .eq('id', authUser.id)
  if (activityError) {
    console.error('[v0] last_activity_at update failed:', activityError.message)
  }

  // Re-read all progress fresh from DB (never trust the in-memory set) to get accurate counts
  const { data: allVideos } = await supabase.from('demo_invest_videos').select('*').order('order_no')
  const { data: allProgress } = await supabase
    .from('demo_invest_video_progress')
    .select('*')
    .eq('user_id', authUser.id)
  // Recount from the fresh DB rows — never blind-increment
  const completedIds = new Set((allProgress ?? []).filter(p => p.status === 'completed').map(p => p.video_id))

  const coreVideos = (allVideos ?? []).filter(v => v.section === 'core')
  const nextVideo = coreVideos.find(v => !completedIds.has(v.id)) ?? null

  // Emit webhook
  if (action === 'started') {
    await emitEvent({ type: 'video.started', user, funnel, nextVideo: video, data: { video_id: videoId, video_title: video?.title } })
  } else if (action === 'progress') {
    await emitEvent({ type: 'video.progress', user, funnel, nextVideo: video, data: { video_id: videoId, progress_pct: safeProgressPct } })
  } else if (action === 'completed') {
    // Count completed core videos from the fresh DB set (completedIds already includes this video
    // because the upsert above wrote 'completed' before we re-read)
    const completedCoreCount = coreVideos.filter(v => completedIds.has(v.id)).length
    const isNewCompletion = existingProgress?.status !== 'completed'

    if (isNewCompletion) {
      await emitEvent({
        type: 'video.completed',
        user,
        funnel: { ...funnel, videos_completed_count: completedCoreCount },
        nextVideo,
        data: {
          video_id: videoId,
          video_title: video?.title,
          stage: completedCoreCount >= 2 ? 'qualified_lead' : 'first_video_completed',
        },
      })

      if (video?.section === 'core' && completedCoreCount === 2) {
        await emitEvent({
          type: 'lead.qualified',
          user,
          funnel: { ...funnel, videos_completed_count: completedCoreCount },
          nextVideo,
          data: { stage: 'qualified_lead', priority: 'high', qualification_rule: '2_core_videos_completed' },
        })
      }
    }

    // Update funnel — upsert so it works even if no funnel row exists yet
    if (video?.section === 'core') {
      const isAllCompleted = completedCoreCount >= 6

      const { error: funnelError } = await supabase
        .from('demo_invest_user_funnel')
        .upsert({
          user_id: authUser.id,
          videos_completed_count: completedCoreCount,
          all_completed_at: isAllCompleted && !funnel?.all_completed_at ? now.toISOString() : (funnel?.all_completed_at ?? null),
          event_booked: funnel?.event_booked ?? false,
          event_booked_at: funnel?.event_booked_at ?? null,
        }, { onConflict: 'user_id' })

      if (funnelError) {
        console.error('[v0] funnel upsert failed:', funnelError.message, funnelError.details)
      }

      if (isAllCompleted && !funnel?.all_completed_at) {
        const updatedFunnel = { ...funnel, videos_completed_count: completedCoreCount, all_completed_at: now.toISOString() }
        await emitEvent({ type: 'videos.all_completed', user, funnel: updatedFunnel, nextVideo: null, data: {} })
        await emitEvent({ type: 'bonus.unlocked', user, funnel: updatedFunnel, nextVideo: null, data: {} })
        await emitEvent({ type: 'event.ticket_unlocked', user, funnel: updatedFunnel, nextVideo: null, data: {} })
        // W11 — instant: alle 6 kernvideo's bekeken
        const { data: existingLogRows } = await supabase
          .from('demo_invest_trigger_log')
          .select('workflow_naam')
          .eq('user_id', authUser.id)
          .eq('status', 'verstuurd')
        const firedNamen = new Set<string>((existingLogRows ?? []).map((r: { workflow_naam: string }) => r.workflow_naam))
        await fireInstant(supabase, 'alles_gezien_c1', user, firedNamen, {
          videos_completed_count: completedCoreCount,
          all_completed_at: now.toISOString(),
        })
      }
    } else if (video?.section === 'bonus') {
      await emitEvent({ type: 'bonus.video_completed', user, funnel, nextVideo: null, data: { video_id: videoId } })
    }
  }

  return NextResponse.json({ ok: true })
}
