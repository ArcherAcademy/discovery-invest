import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/me
 * Returns the current session user's profile, funnel, video progress, and videos.
 * Identity is derived entirely from the httpOnly session cookie — never from
 * a user_id sent by the client.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const [{ data: funnelData }, { data: progressData }, { data: videosData }] = await Promise.all([
    supabase.from('demo_invest_user_funnel').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('demo_invest_video_progress').select('*').eq('user_id', user.id),
    supabase.from('demo_invest_videos').select('*').order('order_no'),
  ])

  return NextResponse.json({
    user,
    funnel: funnelData ?? null,
    progress: progressData ?? [],
    videos: videosData ?? [],
  })
}
