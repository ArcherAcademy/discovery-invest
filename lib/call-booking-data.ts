import type { SupabaseClient } from '@supabase/supabase-js'

const BOOKING_LINKS_KEY = 'persoonlijke_call_boekingslinks'
const USER_STATE_PREFIX = 'persoonlijke_call_user:'

export interface BookingLink {
  id: string
  owner_email: string
  naam: string
  booking_url: string
  actief: boolean
  is_default: boolean
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

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function readConfig<T>(supabase: SupabaseClient, key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from('demo_invest_config')
    .select('waarde')
    .eq('sleutel', key)
    .maybeSingle()

  if (error) throw error
  return parseJson(data?.waarde, fallback)
}

async function writeConfig<T>(supabase: SupabaseClient, key: string, value: T): Promise<void> {
  const { error } = await supabase
    .from('demo_invest_config')
    .upsert({ sleutel: key, waarde: JSON.stringify(value) }, { onConflict: 'sleutel' })

  if (error) throw error
}

export async function getBookingLinks(supabase: SupabaseClient): Promise<BookingLink[]> {
  return readConfig<BookingLink[]>(supabase, BOOKING_LINKS_KEY, [])
}

export async function saveBookingLinks(supabase: SupabaseClient, links: BookingLink[]): Promise<void> {
  await writeConfig(supabase, BOOKING_LINKS_KEY, links)
}

export async function getCallUserState(supabase: SupabaseClient, userId: string): Promise<CallUserState> {
  const state = await readConfig<Partial<CallUserState>>(supabase, `${USER_STATE_PREFIX}${userId}`, {})
  return { ...EMPTY_USER_STATE, ...state }
}

export async function updateCallUserState(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<CallUserState>,
): Promise<CallUserState> {
  const current = await getCallUserState(supabase, userId)
  const next = { ...current, ...updates }
  await writeConfig(supabase, `${USER_STATE_PREFIX}${userId}`, next)
  return next
}

export async function getAllCallUserStates(supabase: SupabaseClient): Promise<Map<string, CallUserState>> {
  const { data, error } = await supabase
    .from('demo_invest_config')
    .select('sleutel, waarde')
    .like('sleutel', `${USER_STATE_PREFIX}%`)

  if (error) throw error

  return new Map((data ?? []).map(row => {
    const userId = row.sleutel.slice(USER_STATE_PREFIX.length)
    const state = { ...EMPTY_USER_STATE, ...parseJson<Partial<CallUserState>>(row.waarde, {}) }
    return [userId, state]
  }))
}

export async function resolveBookingLink(
  supabase: SupabaseClient,
  contactOwnerEmail: string | null | undefined,
): Promise<BookingLinkResult | null> {
  const links = await getBookingLinks(supabase)
  const ownerEmail = contactOwnerEmail?.trim().toLowerCase() || null
  const matching = ownerEmail
    ? links.find(link => link.actief && link.owner_email.toLowerCase() === ownerEmail)
    : undefined
  const selected = matching ?? links.find(link => link.actief && link.is_default)

  if (!selected) return null

  return {
    booking_url: selected.booking_url,
    owner_email: selected.owner_email,
    owner_name: selected.naam,
    is_fallback: !matching,
  }
}
