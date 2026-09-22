import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitEvent } from '@/lib/emit-event'
import { fireInstant } from '@/lib/workflow-engine'
import type { DemoUser, DemoUserFunnel, DemoVideo } from '@/lib/types'

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await req.json() as { videoId: string }
  if (!videoId) return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })

  const supabase = createAdminClient()
  const now = new Date()

  // Load context in parallel
  const [{ data: userData }, { data: funnelData }, { data: videoData }, { data: existingProgress }] = await Promise.all([
    supabase.from('demo_invest_users').select('*').eq('id', authUser.id).single(),
    supabase.from('demo_invest_user_funnel').select('*').eq('user_id', authUser.id).single(),
    supabase.from('demo_invest_videos').select('*').eq('id', videoId).single(),
    supabase.from('demo_invest_video_progress').select('*').eq('user_id', authUser.id).eq('video_id', videoId).single(),
  ])

  const user = userData as DemoUser
  const funnel = funnelData as DemoUserFunnel
  const video = videoData as DemoVideo

  // Upsert completed row — idempotent
  const { error: upsertError } = await supabase
    .from('demo_invest_video_progress')
    .upsert({
      user_id: authUser.id,
      video_id: videoId,
      status: 'completed',
      progress_pct: 100,
      started_at: existingProgress?.started_at ?? now.toISOString(),
      completed_at: existingProgress?.completed_at ?? now.toISOString(),
      last_activity_at: now.toISOString(),
    }, { onConflict: 'user_id,video_id' })

  if (upsertError) {
    console.error('[complete] upsert failed:', upsertError.message)
    return NextResponse.json({ error: 'upsert_failed', detail: upsertError.message }, { status: 500 })
  }

  // Update last_activity on user
  await supabase.from('demo_invest_users').update({ last_activity_at: now.toISOString() }).eq('id', authUser.id)

  // Recount from DB — fresh read
  const [{ data: allVideos }, { data: allProgress }] = await Promise.all([
    supabase.from('demo_invest_videos').select('*').order('order_no'),
    supabase.from('demo_invest_video_progress').select('*').eq('user_id', authUser.id),
  ])

  const completedIds = new Set((allProgress ?? []).filter(p => p.status === 'completed').map(p => p.video_id))
  const coreVideos = (allVideos ?? []).filter(v => v.section === 'core')
  const completedCoreCount = coreVideos.filter(v => completedIds.has(v.id)).length
  const nextVideo = coreVideos.find(v => !completedIds.has(v.id)) ?? null
  const isAllCompleted = completedCoreCount >= 6

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

  // Update funnel
  if (video?.section === 'core') {
    const { error: funnelError } = await supabase
      .from('demo_invest_user_funnel')
      .upsert({
        user_id: authUser.id,
        videos_completed_count: completedCoreCount,
        all_completed_at: isAllCompleted && !funnel?.all_completed_at ? now.toISOString() : (funnel?.all_completed_at ?? null),
        event_booked: funnel?.event_booked ?? false,
        event_booked_at: funnel?.event_booked_at ?? null,
      }, { onConflict: 'user_id' })

    if (funnelError) console.error('[complete] funnel upsert failed:', funnelError.message)

    if (isAllCompleted && !funnel?.all_completed_at) {
      const updatedFunnel = { ...funnel, videos_completed_count: completedCoreCount, all_completed_at: now.toISOString() }
      await Promise.all([
        emitEvent({ type: 'videos.all_completed', user, funnel: updatedFunnel, nextVideo: null, data: {} }),
        emitEvent({ type: 'bonus.unlocked', user, funnel: updatedFunnel, nextVideo: null, data: {} }),
        emitEvent({ type: 'event.ticket_unlocked', user, funnel: updatedFunnel, nextVideo: null, data: {} }),
      ])
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

  return NextResponse.json({
    ok: true,
    videos_completed_count: completedCoreCount,
    all_completed: isAllCompleted,
  })
}
