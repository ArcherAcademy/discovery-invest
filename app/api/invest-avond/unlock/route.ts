import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { getHubSpotAccountOwnerSnapshot } from '@/lib/hubspot-owners'
import { createAdminClient } from '@/lib/supabase/admin'

const HUBSPOT_PORTAL_ID = '25799192'
const HUBSPOT_FORM_ID = '8492815c-48c5-4307-97dd-2663db2f1a8a'
const TEAM_MEMBER_FIELD = 'via_welk_archer_team_member_heb_je_deze_link_toegestuurd_gekregen_'
const EDITION_VALUES: Record<string, string> = {
  'februari-2027': 'februari 2027',
  'juni-2027': 'juni 2027',
  'oktober-2027': 'oktober 2027',
}
const TEAM_MEMBER_VALUES = new Set([
  'Anthony', 'Armani', 'Bjorn', 'Kevin', 'Lennard', 'Nicolas', 'Jietse', 'Bert',
  'Nigel', 'Xavier', 'Creneau', 'Pieter', 'Wout', 'Stijn', 'Lucas',
])

export async function POST(req: NextRequest) {
  const authUser = await getSessionUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { edition?: string } | null
  const preferredEdition = body?.edition ? EDITION_VALUES[body.edition] : null
  if (!preferredEdition) {
    return NextResponse.json({ error: 'invalid_edition' }, { status: 400 })
  }

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

  let snapshot: Awaited<ReturnType<typeof getHubSpotAccountOwnerSnapshot>>
  try {
    snapshot = await getHubSpotAccountOwnerSnapshot([authUser.email])
  } catch (error) {
    console.error('[invest-avond/unlock] HubSpot contact ophalen mislukt:', error)
    return NextResponse.json({ error: 'hubspot_contact_unavailable' }, { status: 502 })
  }

  const normalizedEmail = authUser.email.trim().toLowerCase()
  const ownerId = snapshot.ownerIdByEmail.get(normalizedEmail)
  const ownerName = ownerId ? snapshot.ownersById.get(ownerId)?.name : null
  const ownerFirstName = ownerName?.trim().split(/\s+/)[0] ?? ''
  const teamMember = TEAM_MEMBER_VALUES.has(ownerFirstName) ? ownerFirstName : 'Iemand anders'
  const nameParts = authUser.name.trim().split(/\s+/).filter(Boolean)
  const firstName = nameParts.shift() || authUser.email.split('@')[0]
  const lastName = nameParts.join(' ') || '-'
  const phone = snapshot.phoneByEmail.get(normalizedEmail)
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const hutk = req.cookies.get('hubspotutk')?.value

  const fields = [
    { objectTypeId: '0-1', name: 'firstname', value: firstName },
    { objectTypeId: '0-1', name: 'lastname', value: lastName },
    { objectTypeId: '0-1', name: 'email', value: authUser.email },
    { objectTypeId: '0-1', name: 'voorkeurseditie', value: preferredEdition },
    { objectTypeId: '0-1', name: TEAM_MEMBER_FIELD, value: teamMember },
  ]
  if (phone) fields.splice(2, 0, { objectTypeId: '0-1', name: 'phone', value: phone })

  const hubSpotResponse = await fetch(
    `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submittedAt: Date.now(),
        fields,
        context: {
          pageUri: `${req.nextUrl.origin}/video/6`,
          pageName: 'Invest Masterclass voorkeurseditie',
          ...(forwardedFor ? { ipAddress: forwardedFor } : {}),
          ...(hutk ? { hutk } : {}),
        },
      }),
    },
  )

  if (!hubSpotResponse.ok) {
    const responseBody = await hubSpotResponse.text()
    console.error('[invest-avond/unlock] HubSpot formulierinzending mislukt:', hubSpotResponse.status, responseBody.slice(0, 500))
    return NextResponse.json({ error: 'hubspot_submission_failed' }, { status: 502 })
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
    console.error('[invest-avond/unlock] funnel update failed after successful HubSpot submission:', error)
  }

  return NextResponse.json({ ok: true, submitted: true })
}
