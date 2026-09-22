import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: coreVideos, error: videosError } = await supabase
    .from('demo_invest_videos')
    .select('id')
    .eq('section', 'core')

  if (videosError || !coreVideos || coreVideos.length < 6) {
    return NextResponse.json({ error: 'core_videos_unavailable' }, { status: 500 })
  }

  const { data: completedRows, error: progressError } = await supabase
    .from('demo_invest_video_progress')
    .select('video_id')
    .eq('user_id', authUser.id)
    .eq('status', 'completed')
    .in('video_id', coreVideos.map(video => video.id))

  if (progressError || (completedRows?.length ?? 0) < 6) {
    return NextResponse.json({ error: 'complete_core_videos_first' }, { status: 403 })
  }

  const { error } = await supabase
    .from('demo_invest_user_funnel')
    .upsert({
      user_id: authUser.id,
      invest_avond_geclaimd: true,
      invest_avond_verschenen: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('[invest-avond/unlock] funnel update failed:', error)
    return NextResponse.json({ error: 'unlock_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, unlocked: true })
}
