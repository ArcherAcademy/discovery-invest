export interface Boekingslink {
  id: string
  hubspot_owner_id: string | null
  naam: string
  booking_url: string
  actief: boolean
  is_default: boolean
}

export function kiesBoekingslink(
  hubspotOwnerId: string | null | undefined,
  links: Boekingslink[],
): Boekingslink | null {
  const actieveLinks = links.filter(link => link.actief)
  const ownerId = hubspotOwnerId?.trim()

  if (ownerId) {
    const eigenAccountmanager = actieveLinks.find(
      link => !link.is_default && link.hubspot_owner_id === ownerId,
    )
    if (eigenAccountmanager) return eigenAccountmanager
  }

  return actieveLinks.find(link => link.is_default) ?? null
}

export function maakEmbedUrl(bookingUrl: string): string {
  const url = new URL(bookingUrl)
  url.searchParams.set('embed', 'true')
  return url.toString()
}
