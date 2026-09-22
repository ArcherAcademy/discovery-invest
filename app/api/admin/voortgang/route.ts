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
  const batchSize = 1000

  async function fetchAllUsers() {
    const rows = []
    for (let from = 0; ; from += batchSize) {
      const { data, error } = await supabase
        .from('demo_invest_users')
        .select('id, email, name, activated_at, trial_expires_at, last_activity_at, created_at')
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + batchSize - 1)

      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < batchSize) return rows
    }
  }

  async function fetchAllProgress() {
    const rows = []
    for (let from = 0; ; from += batchSize) {
      const { data, error } = await supabase
        .from('demo_invest_video_progress')
        .select('user_id, video_id, status, progress_pct, started_at, completed_at')
        .order('user_id')
        .order('video_id')
        .range(from, from + batchSize - 1)

      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < batchSize) return rows
    }
  }

  let users: Awaited<ReturnType<typeof fetchAllUsers>> = []
  let progress: Awaited<ReturnType<typeof fetchAllProgress>> = []
  try {
    const results = await Promise.all([
      fetchAllUsers(),
      fetchAllProgress(),
    ])
    users = results[0]
    progress = results[1]
  } catch (error) {
    console.error('[admin/voortgang] Volledige voortgang ophalen mislukt:', error)
    return NextResponse.json(
      { error: 'De volledige voortgang kon niet worden opgehaald.' },
      { status: 500 },
    )
  }

  const [
    { data: videos },
    { data: funnels },
    { data: quizRows },
    { data: followUpDisabledRows },
  ] = await Promise.all([
    supabase
      .from('demo_invest_videos')
      .select('id, order_no, title, section')
      .order('order_no'),
    supabase
      .from('demo_invest_user_funnel')
      .select('user_id, event_booked, event_booked_at, all_completed_at, invest_avond_geclaimd, invest_avond_verschenen'),
    supabase
      .from('demo_invest_quiz_submissions')
      .select('user_id, submitted_at, score, answers'),
    supabase
      .from('demo_invest_trigger_sent')
      .select('user_id')
      .eq('workflow_naam', '__automatische_opvolging_uit__'),
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
  const followUpDisabledUserIds = new Set((followUpDisabledRows ?? []).map(row => row.user_id))

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
    const completedAt = videoStrip
      .map(video => video.completed_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    const leadStage = funnel?.event_booked
      ? 'Afspraak geboekt'
      : completedCount >= 2
        ? 'Gekwalificeerde lead'
        : completedCount === 1
          ? 'Eerste video voltooid'
          : u.activated_at
            ? 'Account geactiveerd'
            : 'Account aangemaakt'
    const leadPriority = funnel?.event_booked || completedCount >= 2
      ? 'hoog'
      : completedCount === 1
        ? 'middel'
        : 'normaal'

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      opvolging_actief: !followUpDisabledUserIds.has(u.id),
      activated_at: u.activated_at,
      last_activity_at: u.last_activity_at,
      ms_since_activity: msSinceActivity,
      days_trial_left: daysTrialLeft,
      trial_expires_at: u.trial_expires_at,
      completed_count: completedCount,
      first_video_completed_at: completedAt[0] ?? null,
      qualified_at: completedAt[1] ?? null,
      lead_stage: leadStage,
      lead_priority: leadPriority,
      current_video: currentVideo ? { id: currentVideo.id, order: currentVideo.order_no, title: currentVideo.title } : null,
      video_strip: videoStrip,
      created_at: u.created_at,
      event_booked: funnel?.event_booked ?? false,
      event_booked_at: funnel?.event_booked_at ?? null,
      all_completed_at: funnel?.all_completed_at ?? null,
      invest_avond_geclaimd: funnel?.invest_avond_geclaimd ?? false,
      invest_avond_verschenen: funnel?.invest_avond_verschenen ?? false,
      contact_owner_email: callState?.contact_owner_email ?? null,
      call_opened_at: callState?.call_opened_at ?? null,
      call_clicked_at: callState?.call_clicked_at ?? null,
      call_booked: callState?.call_booked ?? false,
      call_booked_at: callState?.call_booked_at ?? null,
      quiz_submission: quizByUser.get(u.id) ?? null,
    }
  })

  // ── Aggregated insights ───────────────────────────────────────
  const activatedUsers = userRows.filter(user => Boolean(user.activated_at))
  const total = activatedUsers.length
  const totalAccounts = userRows.length
  const qualifiedLeads = userRows.filter(user => user.completed_count >= 2).length

  // 1. Dropout per video: users for whom this is their highest reached video and they stopped
  const dropoutPerVideo = coreVideos.map(v => {
    const count = activatedUsers.filter(u => {
      const strip = u.video_strip
      const thisIdx = strip.findIndex(s => s.videoId === v.id)
      if (thisIdx < 0) return false
      const thisStatus = strip[thisIdx].status
      const reached = thisStatus === 'completed' || thisStatus === 'in_progress'
      if (!reached) return false
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

  // 3. Beslisfunnel: van instroom tot afspraak, met conversie en doorlooptijd per overgang.
  const milestones = [
    { label: 'Account aangemaakt', timestamp: (user: typeof userRows[number]) => user.created_at },
    { label: 'Account geactiveerd', timestamp: (user: typeof userRows[number]) => user.activated_at },
    { label: 'Eerste video voltooid', timestamp: (user: typeof userRows[number]) => user.first_video_completed_at },
    { label: 'Gekwalificeerde lead', timestamp: (user: typeof userRows[number]) => user.qualified_at },
    { label: "Alle 6 video's voltooid", timestamp: (user: typeof userRows[number]) => user.all_completed_at },
    { label: 'Afspraak geboekt', timestamp: (user: typeof userRows[number]) => user.event_booked_at },
  ]

  const funnelSteps = milestones.map((milestone, index) => {
    const reached = userRows.filter(user => Boolean(milestone.timestamp(user)))
    const previous = milestones[index - 1]
    const previousCount = previous
      ? userRows.filter(user => Boolean(previous.timestamp(user))).length
      : reached.length
    const transitionDurations = previous
      ? reached.flatMap(user => {
          const from = previous.timestamp(user)
          const to = milestone.timestamp(user)
          if (!from || !to) return []
          const minutes = (new Date(to).getTime() - new Date(from).getTime()) / 60000
          return minutes >= 0 ? [minutes] : []
        })
      : []

    return {
      label: milestone.label,
      count: reached.length,
      conversionFromPrevious: index === 0 || previousCount === 0
        ? null
        : Math.round((reached.length / previousCount) * 100),
      dropoff: index === 0 ? 0 : Math.max(0, previousCount - reached.length),
      avgMinutesFromPrevious: transitionDurations.length === 0
        ? null
        : Math.round(transitionDurations.reduce((sum, minutes) => sum + minutes, 0) / transitionDurations.length),
    }
  })

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
    .filter(u => u.activated_at && u.completed_count < 6 && u.ms_since_activity !== null && u.ms_since_activity > 86400000)
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
      totalAccounts,
      qualifiedLeads,
      dropoutPerVideo,
      avgDepthPerVideo,
      funnelSteps,
      tempo: { avgMinutesToFirstVideo, avgMinutesToComplete, completedAll: completedAll.length, within1Day },
      riskList,
    },
  })
}
