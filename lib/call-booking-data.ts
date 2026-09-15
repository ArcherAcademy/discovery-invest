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
  /** Het geboekte afspraaktijdstip zelf (uit demo_invest_webhook_log), niet het moment van boeken. */
  call_start_at: string | null
  call_end_at: string | null
  call_timezone: string | null
}

export interface BookingLinkResult {
  booking_url: string
  owner_email: string | null
  owner_name: string | null
  is_fallback: boolean
}

export interface CallBookingInput {
  start_at?: unknown
  end_at?: unknown
  duration_minutes?: unknown
  timezone?: unknown
  subject?: unknown
  contact_id?: unknown
  organizer_name?: unknown
}

export interface CallBookingPayload {
  booking_key: string
  start_at: string | null
  end_at: string | null
  timezone: string | null
  subject: string | null
  contact_id: string | null
  organizer_name: string | null
  advisor_name: string | null
  advisor_owner_id: string | null
}

export interface AdminCallBooking {
  id: string
  user_id: string
  name: string | null
  email: string
  start_at: string | null
  end_at: string | null
  timezone: string | null
  subject: string | null
  advisor_name: string | null
  booked_at: string
  timing: 'upcoming' | 'past' | 'unknown'
}

const EMPTY_USER_STATE: CallUserState = {
  contact_owner_email: null,
  call_opened_at: null,
  call_clicked_at: null,
  call_booked: false,
  call_booked_at: null,
  call_start_at: null,
  call_end_at: null,
  call_timezone: null,
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
    call_start_at: null,
    call_end_at: null,
    call_timezone: null,
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

  const state = stateFromMarkers(user.hubspot_owner_id ?? null, (markers ?? []) as CallMarkerRow[])
  if (!state.call_booked) return state

  // Verrijk met het effectieve afspraaktijdstip uit de meest recente boeking.
  const { data: log, error: logError } = await supabase
    .from('demo_invest_webhook_log')
    .select('payload_json')
    .eq('user_id', userId)
    .eq('event_type', 'call.booked')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (logError) throw logError

  const payload = (log?.payload_json ?? null) as Partial<CallBookingPayload> | null
  state.call_start_at = normalizedDate(payload?.start_at)
  state.call_end_at = normalizedDate(payload?.end_at)
  state.call_timezone = normalizedText(payload?.timezone, 80)

  return state
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

function normalizedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  return text ? text.slice(0, maxLength) : null
}

function normalizedDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : null
  const date = numericValue !== null
    ? new Date(numericValue < 10_000_000_000 ? numericValue * 1000 : numericValue)
    : new Date(String(value))

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizeCallBookingPayload(
  userId: string,
  input: CallBookingInput | null,
  booking: BookingLinkResult,
): CallBookingPayload {
  const startAt = normalizedDate(input?.start_at)
  let endAt = normalizedDate(input?.end_at)
  const rawDuration = Number(input?.duration_minutes)
  const durationMinutes = rawDuration > 480 ? rawDuration / 60_000 : rawDuration
  if (!endAt && startAt && Number.isFinite(durationMinutes) && durationMinutes >= 5 && durationMinutes <= 480) {
    endAt = new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString()
  }
  if (startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) endAt = null

  const contactId = normalizedText(input?.contact_id, 120)
  const bookingKey = [userId, startAt ?? 'tijd-onbekend', contactId ?? 'contact-onbekend'].join(':')

  return {
    booking_key: bookingKey,
    start_at: startAt,
    end_at: endAt,
    timezone: normalizedText(input?.timezone, 80),
    subject: normalizedText(input?.subject, 180),
    contact_id: contactId,
    organizer_name: normalizedText(input?.organizer_name, 120),
    advisor_name: booking.owner_name,
    advisor_owner_id: booking.owner_email,
  }
}

export async function recordCallBooking(
  supabase: SupabaseClient,
  userId: string,
  payload: CallBookingPayload,
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from('demo_invest_webhook_log')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', 'call.booked')
    .contains('payload_json', { booking_key: payload.booking_key })
    .limit(1)
    .maybeSingle()

  if (readError) throw readError
  if (existing) return

  const { error } = await supabase.from('demo_invest_webhook_log').insert({
    user_id: userId,
    event_type: 'call.booked',
    payload_json: payload,
    response_status: 'registered',
  })
  if (error) throw error
}

interface CallBookingLogRow {
  id: string
  user_id: string
  created_at: string
  payload_json: Partial<CallBookingPayload> | null
}

export async function getAdminCallBookings(supabase: SupabaseClient): Promise<AdminCallBooking[]> {
  const [{ data: users, error: usersError }, { data: logs, error: logsError }, { data: markers, error: markersError }] = await Promise.all([
    supabase.from('demo_invest_users').select('id, name, email'),
    supabase
      .from('demo_invest_webhook_log')
      .select('id, user_id, created_at, payload_json')
      .eq('event_type', 'call.booked')
      .order('created_at', { ascending: false }),
    supabase
      .from('demo_invest_trigger_sent')
      .select('user_id, created_at')
      .eq('workflow_naam', CALL_BOOKED_MARKER)
      .order('created_at', { ascending: false }),
  ])

  if (usersError) throw usersError
  if (logsError) throw logsError
  if (markersError) throw markersError

  const usersById = new Map((users ?? []).map(user => [user.id, user]))
  const bookingLogs = (logs ?? []) as CallBookingLogRow[]
  const usersWithDetailedBookings = new Set(bookingLogs.map(log => log.user_id))
  const now = Date.now()

  const toAdminBooking = (
    id: string,
    userId: string,
    bookedAt: string,
    payload: Partial<CallBookingPayload> | null,
  ): AdminCallBooking | null => {
    const user = usersById.get(userId)
    if (!user?.email) return null
    const startAt = normalizedDate(payload?.start_at)
    const timing: AdminCallBooking['timing'] = !startAt
      ? 'unknown'
      : new Date(startAt).getTime() >= now
        ? 'upcoming'
        : 'past'

    return {
      id,
      user_id: userId,
      name: user.name ?? null,
      email: user.email,
      start_at: startAt,
      end_at: normalizedDate(payload?.end_at),
      timezone: normalizedText(payload?.timezone, 80),
      subject: normalizedText(payload?.subject, 180),
      advisor_name: normalizedText(payload?.advisor_name ?? payload?.organizer_name, 120),
      booked_at: bookedAt,
      timing,
    }
  }

  const detailedBookings = bookingLogs
    .map(log => toAdminBooking(log.id, log.user_id, log.created_at, log.payload_json))
    .filter((booking): booking is AdminCallBooking => booking !== null)
  const legacyBookings = (markers ?? [])
    .filter(marker => !usersWithDetailedBookings.has(marker.user_id))
    .map(marker => toAdminBooking(`historisch-${marker.user_id}`, marker.user_id, marker.created_at, null))
    .filter((booking): booking is AdminCallBooking => booking !== null)

  return [...detailedBookings, ...legacyBookings]
    .sort((a, b) => {
      if (a.timing === 'upcoming' && b.timing === 'upcoming') {
        return new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime()
      }
      if (a.timing !== b.timing) {
        const order = { upcoming: 0, unknown: 1, past: 2 }
        return order[a.timing] - order[b.timing]
      }
      return new Date(b.booked_at).getTime() - new Date(a.booked_at).getTime()
    })
}
