export type AccountInstroom = 'vermogenstest' | 'discovery'

export type AccountSourceLog = {
  created_at: string
  email: string | null
  payload_json: Record<string, unknown>
}

function normalizedValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function payloadUrl(payload: Record<string, unknown>): string {
  return normalizedValue(payload.page_uri)
    || normalizedValue(payload.page_url)
    || normalizedValue(payload.url)
}

function sourceFromPageUrl(value: string): AccountInstroom | null {
  if (!value) return null

  try {
    const pathname = new URL(value).pathname.toLowerCase().replace(/\/$/, '')
    if (pathname === '/demo') return 'discovery'
    if (pathname === '/vermogens-test' || pathname.startsWith('/vermogens-test/')) return 'vermogenstest'
  } catch {
    const pathWithoutQuery = value.split(/[?#]/, 1)[0].replace(/\/$/, '')
    if (pathWithoutQuery.endsWith('/demo')) return 'discovery'
    if (pathWithoutQuery.includes('/vermogens-test')) return 'vermogenstest'
  }

  return null
}

export function classifyAccountSource(payload: Record<string, unknown>): AccountInstroom | null {
  const pageSource = sourceFromPageUrl(payloadUrl(payload))
  if (pageSource) return pageSource

  const explicitSource = normalizedValue(payload.source)
  if (explicitSource.includes('vermogenstest')) return 'vermogenstest'
  if (explicitSource.includes('discovery')) return 'discovery'

  // `website` en `hubspot` zijn transportkanalen, geen instroombronnen. Vrijwel
  // ieder formulier stuurt eerst een website-call en daarna een HubSpot-call.
  return null
}

export function buildAccountSourceByEmail(logs: AccountSourceLog[]): Map<string, AccountInstroom> {
  const sourceByEmail = new Map<string, AccountInstroom>()
  const chronologicalLogs = [...logs].sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const log of chronologicalLogs) {
    const email = log.email?.trim().toLowerCase()
    if (!email || sourceByEmail.has(email)) continue

    const source = classifyAccountSource(log.payload_json ?? {})
    if (source) sourceByEmail.set(email, source)
  }

  return sourceByEmail
}

export function accountSourceLabel(source: AccountInstroom | null | undefined): string {
  if (source === 'vermogenstest') return 'Vermogenstest'
  if (source === 'discovery') return 'Discovery'
  return 'Onbekend'
}
