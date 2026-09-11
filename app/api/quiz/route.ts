import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { QUIZ_QUESTIONS } from '@/lib/quiz-data'
import type { QuizOption } from '@/lib/quiz-data'
import type { DemoQuizAnswer, DemoQuizSubmission } from '@/lib/types'

// ── GET — fetch existing submission for this user ────────────
export async function GET(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('demo_invest_quiz_submissions')
    .select('*')
    .eq('user_id', authUser.id)
    .single()

  return NextResponse.json({ submission: data ?? null })
}

// ── POST — save / overwrite quiz submission ──────────────────
export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Server-side 6/6 guard — never trust the UI
  const { data: funnelData } = await supabase
    .from('demo_invest_user_funnel')
    .select('videos_completed_count, all_completed_at')
    .eq('user_id', authUser.id)
    .single()

  const completed = funnelData?.videos_completed_count ?? 0
  if (completed < 6 || !funnelData?.all_completed_at) {
    return NextResponse.json(
      { error: 'Bekijk eerst alle 6 kernvideo\'s.' },
      { status: 403 }
    )
  }

  const body = await req.json() as { answers: Record<number, QuizOption> }
  const submitted = body.answers

  // Score the answers
  const answers: DemoQuizAnswer[] = QUIZ_QUESTIONS.map(q => ({
    question_no: q.no,
    chosen: submitted[q.no] ?? 'A',
    correct: submitted[q.no] === q.juist,
  }))

  const score = answers.filter(a => a.correct).length
  const now = new Date().toISOString()

  const row = {
    user_id: authUser.id,
    submitted_at: now,
    score,
    answers,
  }

  // Only save the very first submission — never overwrite
  const { data: existing } = await supabase
    .from('demo_invest_quiz_submissions')
    .select('id')
    .eq('user_id', authUser.id)
    .single()

  if (existing) {
    // Return the new scored result client-side only; do NOT save to DB
    return NextResponse.json({
      submission: { ...row, id: existing.id } as DemoQuizSubmission,
      unofficial: true,
    })
  }

  const { data: inserted, error } = await supabase
    .from('demo_invest_quiz_submissions')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('[v0] quiz insert failed:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ submission: inserted as DemoQuizSubmission, unofficial: false })
}
