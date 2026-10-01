import { unstable_cache } from 'next/cache'

type HubSpotContact = {
  id?: string
  properties?: {
    email?: string | null
    hubspot_owner_id?: string | null
  }
}

type HubSpotLead = {
  properties?: {
    hs_primary_contact_id?: string | null
    hubspot_owner_id?: string | null
  }
}

type HubSpotOwner = {
  id?: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

type SearchResponse<T> = {
  results?: T[]
  paging?: {
    next?: {
      after?: string
    }
  }
}

type OwnersResponse = {
  results?: HubSpotOwner[]
  paging?: {
    next?: {
      after?: string
    }
  }
}

const HUBSPOT_API_URL = 'https://api.hubapi.com'
const CONTACT_BATCH_SIZE = 100

function hubSpotHeaders() {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN
  if (!accessToken) throw new Error('HUBSPOT_ACCESS_TOKEN ontbreekt')

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

const getCachedLeadOwners = unstable_cache(
  async (emails: string[]): Promise<Record<string, string | null>> => {
    const ownersByEmail: Record<string, string | null> = {}
    const emailByContactId = new Map<string, string>()

    for (let index = 0; index < emails.length; index += CONTACT_BATCH_SIZE) {
      const batch = emails.slice(index, index + CONTACT_BATCH_SIZE)
      const response = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`, {
        method: 'POST',
        headers: hubSpotHeaders(),
        body: JSON.stringify({
          filterGroups: [{
            filters: [{ propertyName: 'email', operator: 'IN', values: batch }],
          }],
          properties: ['email', 'hubspot_owner_id'],
          limit: 200,
        }),
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) throw new Error(`HubSpot contacten ophalen mislukt (${response.status})`)

      const payload = await response.json() as SearchResponse<HubSpotContact>
      for (const contact of payload.results ?? []) {
        const email = contact.properties?.email?.trim().toLowerCase()
        const contactId = contact.id?.trim()
        if (!email || !contactId) continue
        emailByContactId.set(contactId, email)
        ownersByEmail[email] = contact.properties?.hubspot_owner_id?.trim() || null
      }
    }

    const contactIds = [...emailByContactId.keys()]
    const emailsWithLeadOwner = new Set<string>()
    for (let index = 0; index < contactIds.length; index += CONTACT_BATCH_SIZE) {
      const batch = contactIds.slice(index, index + CONTACT_BATCH_SIZE)
      let after: string | undefined

      do {
        const response = await fetch(`${HUBSPOT_API_URL}/crm/v3/objects/0-136/search`, {
          method: 'POST',
          headers: hubSpotHeaders(),
          body: JSON.stringify({
            filterGroups: [{
              filters: [{ propertyName: 'hs_primary_contact_id', operator: 'IN', values: batch }],
            }],
            properties: ['hs_primary_contact_id', 'hubspot_owner_id'],
            sorts: ['-hs_lastmodifieddate'],
            limit: 200,
            ...(after ? { after } : {}),
          }),
          signal: AbortSignal.timeout(10_000),
        })

        if (!response.ok) throw new Error(`HubSpot leads ophalen mislukt (${response.status})`)

        const payload = await response.json() as SearchResponse<HubSpotLead>
        for (const lead of payload.results ?? []) {
          const contactId = lead.properties?.hs_primary_contact_id?.trim()
          const ownerId = lead.properties?.hubspot_owner_id?.trim()
          const email = contactId ? emailByContactId.get(contactId) : null
          if (email && ownerId && !emailsWithLeadOwner.has(email)) {
            ownersByEmail[email] = ownerId
            emailsWithLeadOwner.add(email)
          }
        }
        after = payload.paging?.next?.after
      } while (after)
    }

    return ownersByEmail
  },
  ['hubspot-lead-owners'],
  { revalidate: 600 },
)

const getCachedOwnerNames = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const ownerNames: Record<string, string> = {}
    let after: string | undefined

    do {
      const searchParams = new URLSearchParams({ limit: '100' })
      if (after) searchParams.set('after', after)

      const response = await fetch(`${HUBSPOT_API_URL}/crm/v3/owners/?${searchParams}`, {
        headers: hubSpotHeaders(),
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`HubSpot owners ophalen mislukt (${response.status})`)

      const payload = await response.json() as OwnersResponse
      for (const owner of payload.results ?? []) {
        const id = owner.id?.trim()
        if (!id) continue
        const fullName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim()
        ownerNames[id] = fullName || owner.email?.trim() || id
      }
      after = payload.paging?.next?.after
    } while (after)

    return ownerNames
  },
  ['hubspot-owner-names'],
  { revalidate: 3600 },
)

export async function getHubSpotLeadOwnersByEmail(emails: string[]) {
  const normalizedEmails = [...new Set(emails.map(email => email.trim().toLowerCase()).filter(Boolean))].sort()
  if (normalizedEmails.length === 0) return {}
  return getCachedLeadOwners(normalizedEmails)
}

export async function getHubSpotOwnerNames() {
  return getCachedOwnerNames()
}
