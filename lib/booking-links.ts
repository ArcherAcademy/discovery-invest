import type { SupabaseClient } from '@supabase/supabase-js'

export interface BookingLinkResult {
  booking_url: string
  owner_email: string | null
  owner_name: string | null
  is_fallback: boolean
}

export async function resolveBookingLink(
  supabase: SupabaseClient,
  contactOwnerEmail: string | null | undefined,
): Promise<BookingLinkResult | null> {
  const ownerEmail = contactOwnerEmail?.trim().toLowerCase() || null

  if (ownerEmail) {
    const { data } = await supabase
      .from('demo_invest_boekingslinks')
      .select('owner_email, naam, booking_url')
      .eq('actief', true)
      .ilike('owner_email', ownerEmail)
      .maybeSingle()

    if (data) {
      return {
        booking_url: data.booking_url,
        owner_email: data.owner_email,
        owner_name: data.naam,
        is_fallback: false,
      }
    }
  }

  const { data: fallback } = await supabase
    .from('demo_invest_boekingslinks')
    .select('owner_email, naam, booking_url')
    .eq('actief', true)
    .eq('is_default', true)
    .maybeSingle()

  if (!fallback) return null

  return {
    booking_url: fallback.booking_url,
    owner_email: fallback.owner_email,
    owner_name: fallback.naam,
    is_fallback: true,
  }
}
