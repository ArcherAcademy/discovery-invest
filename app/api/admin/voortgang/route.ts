import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllCallUserStates } from '@/lib/call-booking-data'

export async function GET(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  const supabase = createAdminClient()

  const [
    { data: users },
    { data: videos },
    { data: progress },
    { data: funnels },
    { data: quizRows },
  ] = await Promise.all([
    supabase
      .from('demo_invest_users')
      .select('id, email, name, activated_at, trial_expires_at, last_activity_at, created_at')
      .not('activated_at', 'is', null)
      .order('activated_at', { ascending: false }),
    supabase
      .from('demo_invest_videos')
      .select('id, order_no, title, section')
      .order('order_no'),
    supabase
      .from('demo_invest_video_progress')
      .select('user_id, video_id, status, progress_pct, started_at, completed_at'),
    supabase
      .from('demo_invest_user_funnel')
      .select('user_id, event_booked, all_completed_at, invest_avond_geclaimd, invest_avond_verschenen'),
    supabase
      .from('demo_invest_quiz_submissions')
      .select('user_id, submitted_at, score, answers'),
  ])

  const callStates = await getAllCallUserStates(supabase)
  const coreVideos = (videos ?? []).filter(v => v.section === 'core')
  const now = Date.now()

  // Index progress by user_id → video_id
  type ProgressRow = { user_id: string; video_id: string; status: string; progress_pct: number; started_at: string | null; completed_at: string | null }
  const progressByUser = new Map<string, Map<string, ProgressRow>>()
  for (const p of progress ?? []) {
    if (!progressByUser.has(p.user_id)) progressByUser.set(p.user_id, new Map())
    progressByUser.get(p.user_id)!.set(p.video_id, p)
  }

  const funnelByUser = new Map((funnels ?? []).map(f => [f.user_id, f]))
  const quizByUser = new Map((quizRows ?? []).map(q => [q.user_id, q]))

  // ── Per-user rows ─────────────────────────────────────────────
  const userRows = (users ?? []).map(u => {
    const uProgress = progressByUser.get(u.id) ?? new Map()
    const funnel = funnelByUser.get(u.id)
    const callState = callStates.get(u.id)

    // Always recount from DB rows
    const completedCount = coreVideos.filter(v => uProgress.get(v.id)?.status === 'completed').length

    // First incomplete core video = current video
    const currentVideo = coreVideos.find(v => uProgress.get(v.id)?.status !== 'completed') ?? null

    // Video status strip (all 6 core videos)
    const videoStrip = coreVideos.map(v => {
      const p = uProgress.get(v.id)
      return {
        videoId: v.id,
        order: v.order_no,
        title: v.title,
        status: (p?.status ?? 'not_started') as 'not_started' | 'in_progress' | 'completed',
        progress_pct: p?.progress_pct ?? 0,
        started_at: p?.started_at ?? null,
        completed_at: p?.completed_at ?? null,
      }
    })

    const msSinceActivity = u.last_activity_at ? now - new Date(u.last_activity_at).getTime() : null
    const daysTrialLeft = u.trial_expires_at
      ? Math.max(0, Math.ceil((new Date(u.trial_expires_at).getTime() - now) / 86400000))
      : null

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      activated_at: u.activated_at,
      last_activity_at: u.last_activity_at,
      ms_since_activity: msSinceActivity,
      days_trial_left: daysTrialLeft,
      trial_expires_at: u.trial_expires_at,
      completed_count: completedCount,
      current_video: currentVideo ? { id: currentVideo.id, order: currentVideo.order_no, title: currentVideo.title } : null,
      video_strip: videoStrip,
      created_at: u.created_at,
      event_booked: funnel?.event_booked ?? false,
      all_completed_at: funnel?.all_completed_at ?? null,
      invest_avond_geclaimd: funnel?.invest_avond_geclaimd ?? false,
      invest_avond_verschenen: funnel?.invest_avond_verschenen ?? false,
<<<<<<< HEAD
      contact_owner_email: callState?.contact_owner_email ?? null,
      call_opened_at: callState?.call_opened_at ?? null,
      call_clicked_at: callState?.call_clicked_at ?? null,
      call_booked: callState?.call_booked ?? false,
      call_booked_at: callState?.call_booked_at ?? null,
=======
>>>>>>> d07dbb592d769ac5132e83f8175d00cab89db11a
      quiz_submission: quizByUser.get(u.id) ?? null,
    }
  })

  // ── Aggregated insights ───────────────────────────────────────
  const activatedUsers = userRows
  const total = activatedUsers.length

  // 1. Dropout per video: users for whom this is their highest reached video and they stopped
  const dropoutPerVideo = coreVideos.map(v => {
    const count = activatedUsers.filter(u => {
      const strip = u.video_strip
      const thisIdx = strip.findIndex(s => s.videoId === v.id)
      if (thisIdx < 0) return false
      const thisStatus = strip[thisIdx].status
      // Reached this video (started or completed)
      const reached = thisStatus === 'completed' || thisStatus === 'in_progress'
      if (!reached) return false
      // No subsequent video started
      const nextStarted = strip.slice(thisIdx + 1).some(s => s.status !== 'not_started')
      return !nextStarted && u.completed_count < 6
    }).length
    return { videoId: v.id, order: v.order_no, title: v.title, dropout: count }
  })

  // 2. Average progress_pct per video
  const avgDepthPerVideo = coreVideos.map(v => {
    const started = (progress ?? []).filter(p => p.video_id === v.id && p.progress_pct > 0)
    const avg = started.length === 0 ? 0 : Math.round(started.reduce((s, p) => s + p.progress_pct, 0) / started.length)
    return { videoId: v.id, order: v.order_no, title: v.title, avg_pct: avg, started_count: started.length }
  })

  // 3. Funnel
  const funnelSteps = [
    { label: 'Geactiveerd', count: total },
    ...coreVideos.map(v => {
      const started = activatedUsers.filter(u => u.video_strip.find(s => s.videoId === v.id)?.status !== 'not_started').length
      const completed = activatedUsers.filter(u => u.video_strip.find(s => s.videoId === v.id)?.status === 'completed').length
      return [
        { label: `V${v.order_no} gestart`, count: started },
        { label: `V${v.order_no} voltooid`, count: completed },
      ]
    }).flat(),
    { label: 'Event geboekt', count: activatedUsers.filter(u => u.event_booked).length },
  ]

  // 4. Tempo
  const withFirstVideo = activatedUsers.filter(u => {
    return u.video_strip.some(s => s.started_at !== null)
  })
  const avgMinutesToFirstVideo = withFirstVideo.length === 0 ? null : Math.round(
    withFirstVideo.reduce((sum, u) => {
      const firstStarted = u.video_strip.find(s => s.started_at)
      if (!firstStarted?.started_at || !u.activated_at) return sum
      // Clamp to 0 — test accounts can have started_at before activated_at
      const delta = new Date(firstStarted.started_at).getTime() - new Date(u.activated_at).getTime()
      return sum + Math.max(0, delta) / 60000
    }, 0) / withFirstVideo.length
  )

  const completedAll = activatedUsers.filter(u => u.completed_count === 6 && u.all_completed_at)
  const avgMinutesToComplete = completedAll.length === 0 ? null : Math.round(
    completedAll.reduce((sum, u) => {
      if (!u.all_completed_at || !u.activated_at) return sum
      return sum + (new Date(u.all_completed_at).getTime() - new Date(u.activated_at).getTime()) / 60000
    }, 0) / completedAll.length
  )

  const within1Day = completedAll.filter(u => {
    if (!u.all_completed_at || !u.activated_at) return false
    return (new Date(u.all_completed_at).getTime() - new Date(u.activated_at).getTime()) <= 86400000
  }).length

  // 5. Inactivity risk list: activated, < 6/6, inactive > 24h
  const riskList = activatedUsers
    .filter(u => u.completed_count < 6 && u.ms_since_activity !== null && u.ms_since_activity > 86400000)
    .sort((a, b) => (b.ms_since_activity ?? 0) - (a.ms_since_activity ?? 0))
    .map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      completed_count: u.completed_count,
      ms_since_activity: u.ms_since_activity,
      days_trial_left: u.days_trial_left,
    }))

  return NextResponse.json({
    userRows,
    insights: {
      total,
      dropoutPerVideo,
      avgDepthPerVideo,
      funnelSteps,
      tempo: { avgMinutesToFirstVideo, avgMinutesToComplete, completedAll: completedAll.length, within1Day },
      riskList,
    },
  })
}
