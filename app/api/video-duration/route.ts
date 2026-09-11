import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/video-duration
 * Persists the real Vimeo duration (from getDuration()) back to demo_invest_videos.duration_seconds.
 * Only updates when the value changed, to avoid unnecessary writes.
 */
export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId, durationSeconds } = await req.json() as {
    videoId: string
    durationSeconds: number
  }

  if (!videoId || typeof durationSeconds !== 'number' || durationSeconds <= 0) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Only update if different from stored value to avoid unnecessary writes
  const { data: existing } = await supabase
    .from('demo_invest_videos')
    .select('duration_seconds')
    .eq('id', videoId)
    .single()

  if (existing?.duration_seconds !== Math.round(durationSeconds)) {
    await supabase
      .from('demo_invest_videos')
      .update({ duration_seconds: Math.round(durationSeconds) })
      .eq('id', videoId)
  }

  return NextResponse.json({ ok: true })
}
