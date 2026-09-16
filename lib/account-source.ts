export type AccountInstroom = 'vermogenstest' | 'discovery'

function normalizedValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isVermogenstestUri(value: unknown): boolean {
  const uri = normalizedValue(value)
  if (!uri) return false

  return uri.includes('archerinvest.be')
    || uri.includes('lovable.app')
    || uri.includes('lovableproject.com')
    || uri.includes('vermogenstest')
}

export function classifyAccountSource(payload: Record<string, unknown>): AccountInstroom | null {
  const explicitSource = normalizedValue(payload.source)

  if (explicitSource === 'website' || explicitSource.includes('vermogenstest')) return 'vermogenstest'
  if (explicitSource === 'hubspot' || explicitSource.includes('discovery')) return 'discovery'

  if (isVermogenstestUri(payload.page_uri) || isVermogenstestUri(payload.page_url) || isVermogenstestUri(payload.url)) {
    return 'vermogenstest'
  }

  const recordedSource = normalizedValue(payload._bron)
  if (recordedSource === 'website') return 'vermogenstest'
  if (recordedSource === 'hubspot') return 'discovery'

  return null
}

export function accountSourceLabel(source: AccountInstroom | null | undefined): string {
  if (source === 'vermogenstest') return 'Vermogenstest'
  if (source === 'discovery') return 'Discovery'
  return 'Onbekend'
}
