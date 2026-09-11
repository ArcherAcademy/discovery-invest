import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function authorize(req: NextRequest) {
  try {
    await requireAdmin(req)
    return null
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status: message === 'Forbidden' ? 403 : 401 })
  }
}

export async function GET(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied

  const { data, error } = await createAdminClient()
    .from('demo_invest_boekingslinks')
    .select('*')
    .order('naam')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied

  const body = await req.json() as { owner_email?: string; naam?: string; booking_url?: string; actief?: boolean; is_default?: boolean }
  const ownerEmail = body.owner_email?.trim().toLowerCase()
  const naam = body.naam?.trim()
  const bookingUrl = body.booking_url?.trim()

  if (!ownerEmail || !naam || !bookingUrl) {
    return NextResponse.json({ error: 'E-mail, naam en boekingslink zijn verplicht.' }, { status: 400 })
  }
  try {
    const url = new URL(bookingUrl)
    if (url.protocol !== 'https:') throw new Error()
  } catch {
    return NextResponse.json({ error: 'Gebruik een geldige https-link.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (body.is_default) {
    await supabase.from('demo_invest_boekingslinks').update({ is_default: false }).eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('demo_invest_boekingslinks')
    .upsert({
      owner_email: ownerEmail,
      naam,
      booking_url: bookingUrl,
      actief: body.actief ?? true,
      is_default: body.is_default ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_email' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, link: data })
}

export async function DELETE(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID ontbreekt.' }, { status: 400 })

  const { error } = await createAdminClient().from('demo_invest_boekingslinks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
