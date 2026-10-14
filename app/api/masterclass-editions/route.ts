import { NextResponse } from 'next/server'

const WAITLIST_URL = 'https://archerinvest.be/wachtlijst'
const DAY_IN_MS = 24 * 60 * 60 * 1000

type SourceEdition = {
  title: string
  start: string
  salesOpen: string
  baseFill: number
}

const FALLBACK_EDITIONS: SourceEdition[] = [
  { title: '4–7 februari 2027', start: '2027-02-04', salesOpen: '2026-09-01', baseFill: 18 },
  { title: '3–6 juni 2027', start: '2027-06-03', salesOpen: '2027-02-01', baseFill: 12 },
  { title: '7–10 oktober 2027', start: '2027-10-07', salesOpen: '2027-06-01', baseFill: 10 },
]

function calculateFilledPercentage(edition: SourceEdition, now: Date) {
  const startsAt = new Date(`${edition.start}T00:00:00`)
  const reachesMaximumAt = new Date(startsAt.getTime() - 7 * DAY_IN_MS)
  const salesOpenAt = new Date(`${edition.salesOpen}T00:00:00`)

  if (now >= reachesMaximumAt) return 92
  if (now <= salesOpenAt) return edition.baseFill

  const elapsed = (now.getTime() - salesOpenAt.getTime()) / (reachesMaximumAt.getTime() - salesOpenAt.getTime())
  return Math.round(edition.baseFill + elapsed * (92 - edition.baseFill))
}

function extractEditions(bundle: string): SourceEdition[] {
  const editionPattern = /\{key:"[^"]+",month:"[^"]+",days:"[^"]+",year:"[^"]+",title:"([^"]+)",desc:"[^"]+",start:"(\d{4}-\d{2}-\d{2})",salesOpen:"(\d{4}-\d{2}-\d{2})",baseFill:(\d+),open:(?:!0|!1)\}/g

  return Array.from(bundle.matchAll(editionPattern), match => ({
    title: match[1],
    start: match[2],
    salesOpen: match[3],
    baseFill: Number(match[4]),
  }))
}

export async function GET() {
  try {
    const pageResponse = await fetch(WAITLIST_URL, { next: { revalidate: 900 } })
    if (!pageResponse.ok) throw new Error(`Wachtlijstpagina gaf status ${pageResponse.status}`)

    const page = await pageResponse.text()
    const scriptPath = page.match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)?.[1]
    if (!scriptPath) throw new Error('Actuele wachtlijstbundle niet gevonden')

    const bundleResponse = await fetch(new URL(scriptPath, WAITLIST_URL), { next: { revalidate: 900 } })
    if (!bundleResponse.ok) throw new Error(`Wachtlijstbundle gaf status ${bundleResponse.status}`)

    const editions = extractEditions(await bundleResponse.text())
    const now = new Date()
    const nextEdition = editions
      .filter(edition => new Date(`${edition.start}T23:59:59`) >= now)
      .sort((first, second) => first.start.localeCompare(second.start))[0]

    if (!nextEdition) throw new Error('Geen toekomstige editie in de wachtlijstbron gevonden')

    const filledPercentage = calculateFilledPercentage(nextEdition, now)

    return NextResponse.json({
      edition: {
        title: nextEdition.title,
        startsAt: nextEdition.start,
        filledPercentage,
        availablePercentage: 100 - filledPercentage,
      },
      source: WAITLIST_URL,
    })
  } catch (error) {
    console.error('[masterclass-editions] Live wachtlijstdata laden mislukt, fallback wordt gebruikt:', error)
    const now = new Date()
    const nextEdition = FALLBACK_EDITIONS.find(edition => new Date(`${edition.start}T23:59:59`) >= now)

    if (!nextEdition) {
      return NextResponse.json({ error: 'live_edition_unavailable' }, { status: 502 })
    }

    const filledPercentage = calculateFilledPercentage(nextEdition, now)
    return NextResponse.json({
      edition: {
        title: nextEdition.title,
        startsAt: nextEdition.start,
        filledPercentage,
        availablePercentage: 100 - filledPercentage,
      },
      source: 'fallback',
    })
  }
}
