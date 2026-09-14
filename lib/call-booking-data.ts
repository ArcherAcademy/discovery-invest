import type { SupabaseClient } from '@supabase/supabase-js'

const CALL_OPENED_MARKER = '__persoonlijke_call_geopend__'
const CALL_CLICKED_MARKER = '__persoonlijke_call_geklikt__'
const CALL_BOOKED_MARKER = '__persoonlijke_call_geboekt__'
const CALL_MARKERS = [CALL_OPENED_MARKER, CALL_CLICKED_MARKER, CALL_BOOKED_MARKER]

export interface BookingLink {
  id: string
  owner_email: string
  naam: string
  booking_url: string
  actief: boolean
  is_default: boolean
}

interface BookingLinkRow {
  id: string
  hubspot_owner_id: string
  naam: string
  booking_url: string
  actief: boolean
  is_default: boolean
}

interface CallMarkerRow {
  user_id: string
  workflow_naam: string
  created_at: string
}

export interface CallUserState {
  contact_owner_email: string | null
  call_opened_at: string | null
  call_clicked_at: string | null
  call_booked: boolean
  call_booked_at: string | null
}

export interface BookingLinkResult {
  booking_url: string
  owner_email: string | null
  owner_name: string | null
  is_fallback: boolean
}

const EMPTY_USER_STATE: CallUserState = {
  contact_owner_email: null,
  call_opened_at: null,
  call_clicked_at: null,
  call_booked: false,
  call_booked_at: null,
}

function toBookingLink(row: BookingLinkRow): BookingLink {
  return {
    id: row.id,
    owner_email: row.hubspot_owner_id,
    naam: row.naam,
    booking_url: row.booking_url,
    actief: row.actief,
    is_default: row.is_default,
  }
}

function stateFromMarkers(ownerId: string | null, markers: CallMarkerRow[]): CallUserState {
  const markerTime = (name: string) => markers.find(marker => marker.workflow_naam === name)?.created_at ?? null
  const bookedAt = markerTime(CALL_BOOKED_MARKER)

  return {
    contact_owner_email: ownerId,
    call_opened_at: markerTime(CALL_OPENED_MARKER),
    call_clicked_at: markerTime(CALL_CLICKED_MARKER),
    call_booked: Boolean(bookedAt),
    call_booked_at: bookedAt,
  }
}

export async function getBookingLinks(supabase: SupabaseClient): Promise<BookingLink[]> {
  const { data, error } = await supabase
    .from('demo_invest_boekingslinks')
    .select('id, hubspot_owner_id, naam, booking_url, actief, is_default')
    .order('created_at')

  if (error) throw error
  return ((data ?? []) as BookingLinkRow[]).map(toBookingLink)
}

export async function saveBookingLinks(supabase: SupabaseClient, links: BookingLink[]): Promise<void> {
  const defaultCount = links.filter(link => link.is_default).length
  if (defaultCount > 1) throw new Error('Er kan maar één standaardlink zijn.')

  const { data: existing, error: readError } = await supabase
    .from('demo_invest_boekingslinks')
    .select('id')
  if (readError) throw readError

  if (defaultCount === 1) {
    const { error } = await supabase
      .from('demo_invest_boekingslinks')
      .update({ is_default: false })
      .eq('is_default', true)
    if (error) throw error
  }

  if (links.length > 0) {
    const { error } = await supabase.from('demo_invest_boekingslinks').upsert(
      links.map(link => ({
        id: link.id,
        hubspot_owner_id: link.owner_email.trim(),
        naam: link.naam.trim(),
        booking_url: link.booking_url.trim(),
        actief: link.actief,
        is_default: link.is_default,
      })),
      { onConflict: 'id' },
    )
    if (error) throw error
  }

  const retainedIds = new Set(links.map(link => link.id))
  const removedIds = (existing ?? []).map(row => row.id).filter(id => !retainedIds.has(id))
  if (removedIds.length > 0) {
    const { error } = await supabase.from('demo_invest_boekingslinks').delete().in('id', removedIds)
    if (error) throw error
  }
}

export async function getCallUserState(supabase: SupabaseClient, userId: string): Promise<CallUserState> {
  const [{ data: user, error: userError }, { data: markers, error: markerError }] = await Promise.all([
    supabase.from('demo_invest_users').select('hubspot_owner_id').eq('id', userId).maybeSingle(),
    supabase
      .from('demo_invest_trigger_sent')
      .select('user_id, workflow_naam, created_at')
      .eq('user_id', userId)
      .in('workflow_naam', CALL_MARKERS),
  ])

  if (userError) throw userError
  if (markerError) throw markerError
  if (!user) return EMPTY_USER_STATE

  return stateFromMarkers(user.hubspot_owner_id ?? null, (markers ?? []) as CallMarkerRow[])
}

async function setMarker(
  supabase: SupabaseClient,
  userId: string,
  marker: string,
  timestamp: string | null,
): Promise<void> {
  if (timestamp) {
    const { error } = await supabase.from('demo_invest_trigger_sent').upsert({
      user_id: userId,
      workflow_naam: marker,
      created_at: timestamp,
    }, { onConflict: 'user_id,workflow_naam' })
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('demo_invest_trigger_sent')
    .delete()
    .eq('user_id', userId)
    .eq('workflow_naam', marker)
  if (error) throw error
}

export async function updateCallUserState(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<CallUserState>,
): Promise<CallUserState> {
  if ('contact_owner_email' in updates) {
    const { error } = await supabase
      .from('demo_invest_users')
      .update({ hubspot_owner_id: updates.contact_owner_email?.trim() || null })
      .eq('id', userId)
    if (error) throw error
  }

  if ('call_opened_at' in updates) {
    await setMarker(supabase, userId, CALL_OPENED_MARKER, updates.call_opened_at ?? null)
  }
  if ('call_clicked_at' in updates) {
    await setMarker(supabase, userId, CALL_CLICKED_MARKER, updates.call_clicked_at ?? null)
  }
  if ('call_booked' in updates || 'call_booked_at' in updates) {
    const bookedAt = updates.call_booked === false
      ? null
      : updates.call_booked_at ?? (updates.call_booked ? new Date().toISOString() : null)
    await setMarker(supabase, userId, CALL_BOOKED_MARKER, bookedAt)
  }

  return getCallUserState(supabase, userId)
}

export async function getAllCallUserStates(supabase: SupabaseClient): Promise<Map<string, CallUserState>> {
  const [{ data: users, error: userError }, { data: markers, error: markerError }] = await Promise.all([
    supabase.from('demo_invest_users').select('id, hubspot_owner_id'),
    supabase
      .from('demo_invest_trigger_sent')
      .select('user_id, workflow_naam, created_at')
      .in('workflow_naam', CALL_MARKERS),
  ])

  if (userError) throw userError
  if (markerError) throw markerError

  const markersByUser = new Map<string, CallMarkerRow[]>()
  for (const marker of (markers ?? []) as CallMarkerRow[]) {
    const current = markersByUser.get(marker.user_id) ?? []
    current.push(marker)
    markersByUser.set(marker.user_id, current)
  }

  return new Map((users ?? []).map(user => [
    user.id,
    stateFromMarkers(user.hubspot_owner_id ?? null, markersByUser.get(user.id) ?? []),
  ]))
}

export async function resolveBookingLink(
  supabase: SupabaseClient,
  contactOwnerEmail: string | null | undefined,
): Promise<BookingLinkResult | null> {
  const ownerId = contactOwnerEmail?.trim() || null

  if (ownerId) {
    const { data, error } = await supabase
      .from('demo_invest_boekingslinks')
      .select('hubspot_owner_id, naam, booking_url')
      .eq('actief', true)
      .eq('hubspot_owner_id', ownerId)
      .maybeSingle()

    if (error) throw error
    if (data) {
      return {
        booking_url: data.booking_url,
        owner_email: data.hubspot_owner_id,
        owner_name: data.naam,
        is_fallback: false,
      }
    }
  }

  const { data: fallback, error } = await supabase
    .from('demo_invest_boekingslinks')
    .select('hubspot_owner_id, naam, booking_url')
    .eq('actief', true)
    .eq('is_default', true)
    .maybeSingle()

  if (error) throw error
  if (!fallback) return null

  return {
    booking_url: fallback.booking_url,
    owner_email: fallback.hubspot_owner_id,
    owner_name: fallback.naam,
    is_fallback: true,
  }
}
