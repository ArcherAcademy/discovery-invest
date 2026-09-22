import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/video-access?videoId=<id>
 *
 * Returns { allowed: true } when the user may watch this video.
 * Returns { allowed: false, reason: '...' } otherwise.
 *
 * Rules:
 *  - Video 1 (order_no = 1) is always allowed.
 *  - Video N is allowed only when video N-1 has status = 'completed' in demo_invest_video_progress.
 *  - Bonus videos are allowed only when all 6 core videos are completed.
 *  - Reads fresh from DB on every call — never trusts cached state.
 */
export async function GET(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ allowed: false, reason: 'unauthenticated' }, { status: 401 })

  const videoId = req.nextUrl.searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ allowed: false, reason: 'missing_video_id' }, { status: 400 })

  const supabase = createAdminClient()

  // Load all videos ordered
  const { data: allVideos, error: videosError } = await supabase
    .from('demo_invest_videos')
    .select('id, section, order_no')
    .order('order_no')

  if (videosError || !allVideos) {
    return NextResponse.json({ allowed: false, reason: 'db_error' }, { status: 500 })
  }

  const target = allVideos.find(v => v.id === videoId)
  if (!target) return NextResponse.json({ allowed: false, reason: 'video_not_found' }, { status: 404 })

  // Load this user's completed video ids — fresh from DB
  const { data: progressRows, error: progressError } = await supabase
    .from('demo_invest_video_progress')
    .select('video_id, status')
    .eq('user_id', authUser.id)

  if (progressError) {
    return NextResponse.json({ allowed: false, reason: 'db_error' }, { status: 500 })
  }

  const completedIds = new Set(
    (progressRows ?? []).filter(p => p.status === 'completed').map(p => p.video_id)
  )

  const coreVideos = allVideos.filter(v => v.section === 'core').sort((a, b) => a.order_no - b.order_no)
  const coreCompletedCount = coreVideos.filter(v => completedIds.has(v.id)).length

  if (target.section === 'bonus') {
    if (coreCompletedCount < 6) {
      return NextResponse.json({
        allowed: false,
        reason: 'bonus_locked',
        message: 'Kijk eerst alle 6 kernvideo\'s af om het bonusmateriaal te ontgrendelen.',
      })
    }

    return NextResponse.json({ allowed: true })
  }

  // Core video: find its index
  const coreIndex = coreVideos.findIndex(v => v.id === videoId)
  if (coreIndex === -1) return NextResponse.json({ allowed: true }) // non-core, non-bonus: always allow

  if (coreIndex === 0) {
    // Video 1: always allowed
    return NextResponse.json({ allowed: true })
  }

  // Video N: previous video (coreIndex - 1) must be completed
  const previousVideo = coreVideos[coreIndex - 1]
  if (!completedIds.has(previousVideo.id)) {
    return NextResponse.json({
      allowed: false,
      reason: 'previous_not_completed',
      previousVideoId: previousVideo.id,
      message: `Kijk eerst de vorige video volledig af (80%+) om deze video te ontgrendelen.`,
    })
  }

  return NextResponse.json({ allowed: true })
}
