import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrMentor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBookingLinks, saveBookingLinks, type BookingLink } from '@/lib/call-booking-data'

async function authorize(req: NextRequest) {
  try {
    await requireAdminOrMentor(req)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }
}

export async function GET(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied

  try {
    const links = await getBookingLinks(createAdminClient())
    return NextResponse.json({ links })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Laden mislukt.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied

  const body = await req.json() as Partial<BookingLink>
  const ownerId = body.owner_email?.trim()
  const naam = body.naam?.trim()
  const bookingUrl = body.booking_url?.trim()

  if (!ownerId || !naam || !bookingUrl) {
    return NextResponse.json({ error: 'HubSpot owner-ID, naam en boekingslink zijn verplicht.' }, { status: 400 })
  }
  try {
    const url = new URL(bookingUrl)
    if (url.protocol !== 'https:') throw new Error()
  } catch {
    return NextResponse.json({ error: 'Gebruik een geldige https-link.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  try {
    const links = await getBookingLinks(supabase)
    const duplicate = links.find(link => link.owner_email === ownerId && link.id !== body.id)
    if (duplicate) {
      return NextResponse.json({ error: 'Voor deze HubSpot owner-ID bestaat al een boekingslink.' }, { status: 409 })
    }

    const link: BookingLink = {
      id: body.id ?? crypto.randomUUID(),
      owner_email: ownerId,
      naam,
      booking_url: bookingUrl,
      actief: body.actief ?? true,
      is_default: body.is_default ?? false,
    }
    const normalized = links
      .filter(item => item.id !== link.id)
      .map(item => link.is_default ? { ...item, is_default: false } : item)
    normalized.push(link)
    await saveBookingLinks(supabase, normalized)
    return NextResponse.json({ ok: true, link })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Opslaan mislukt.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID ontbreekt.' }, { status: 400 })

  const supabase = createAdminClient()
  try {
    const links = await getBookingLinks(supabase)
    await saveBookingLinks(supabase, links.filter(link => link.id !== id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verwijderen mislukt.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
