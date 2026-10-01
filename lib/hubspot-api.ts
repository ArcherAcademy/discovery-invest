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

const HUBSPOT_API_URL = 'https://api.hubapi.com'
const CONTACT_BATCH_SIZE = 100
const REQUEST_TIMEOUT_MS = 12_000
const MAX_ATTEMPTS = 4
const MAX_PAGES_PER_BATCH = 50
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

function hubSpotHeaders() {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN
  if (!accessToken) throw new Error('HUBSPOT_ACCESS_TOKEN ontbreekt')

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function retryDelayMs(response: Response | null, attempt: number) {
  const retryAfter = response?.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(seconds * 1_000, 10_000)

    const retryDate = Date.parse(retryAfter)
    if (Number.isFinite(retryDate)) return Math.min(Math.max(retryDate - Date.now(), 0), 10_000)
  }

  return Math.min(400 * (2 ** attempt) + Math.floor(Math.random() * 200), 5_000)
}

async function wait(milliseconds: number) {
  await new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function fetchHubSpotJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Response | null = null
    try {
      response = await fetch(`${HUBSPOT_API_URL}${path}`, {
        ...init,
        headers: {
          ...hubSpotHeaders(),
          ...init.headers,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (response.ok) return await response.json() as T

      lastError = new Error(`HubSpot API gaf status ${response.status} voor ${path}`)
      if (!RETRYABLE_STATUS_CODES.has(response.status)) throw lastError
    } catch (error) {
      lastError = error
      if (error instanceof Error && error.message.includes('HubSpot API gaf status')) {
        const status = Number(error.message.match(/status (\d+)/)?.[1])
        if (!RETRYABLE_STATUS_CODES.has(status)) throw error
      }
    }

    if (attempt < MAX_ATTEMPTS - 1) await wait(retryDelayMs(response, attempt))
  }

  throw lastError instanceof Error ? lastError : new Error(`HubSpot API-aanroep mislukt voor ${path}`)
}

const getCachedLeadOwners = unstable_cache(
  async (emails: string[]): Promise<Record<string, string | null>> => {
    const ownersByEmail: Record<string, string | null> = {}
    const emailByContactId = new Map<string, string>()

    for (let index = 0; index < emails.length; index += CONTACT_BATCH_SIZE) {
      const batch = emails.slice(index, index + CONTACT_BATCH_SIZE)
      try {
        const payload = await fetchHubSpotJson<SearchResponse<HubSpotContact>>('/crm/v3/objects/contacts/search', {
          method: 'POST',
          body: JSON.stringify({
            filterGroups: [{
              filters: [{ propertyName: 'email', operator: 'IN', values: batch }],
            }],
            properties: ['email', 'hubspot_owner_id'],
            limit: 200,
          }),
        })

        for (const contact of payload.results ?? []) {
          const email = contact.properties?.email?.trim().toLowerCase()
          const contactId = contact.id?.trim()
          if (!email || !contactId) continue
          emailByContactId.set(contactId, email)
          ownersByEmail[email] = contact.properties?.hubspot_owner_id?.trim() || null
        }
      } catch (error) {
        console.error(`[HubSpot API] Contactbatch ${index / CONTACT_BATCH_SIZE + 1} mislukt:`, error)
      }
    }

    const contactIds = [...emailByContactId.keys()]
    const emailsWithLeadOwner = new Set<string>()
    for (let index = 0; index < contactIds.length; index += CONTACT_BATCH_SIZE) {
      const batch = contactIds.slice(index, index + CONTACT_BATCH_SIZE)
      let after: string | undefined
      let page = 0

      try {
        do {
          page += 1
          if (page > MAX_PAGES_PER_BATCH) throw new Error('HubSpot leadpaginering overschreed de veiligheidslimiet')

          const payload = await fetchHubSpotJson<SearchResponse<HubSpotLead>>('/crm/v3/objects/0-136/search', {
            method: 'POST',
            body: JSON.stringify({
              filterGroups: [{
                filters: [{ propertyName: 'hs_primary_contact_id', operator: 'IN', values: batch }],
              }],
              properties: ['hs_primary_contact_id', 'hubspot_owner_id'],
              sorts: ['-hs_lastmodifieddate'],
              limit: 200,
              ...(after ? { after } : {}),
            }),
          })

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
      } catch (error) {
        // Wis alleen onzekere null-resultaten uit deze batch. De adminroute valt
        // dan terug op de laatst lokaal bekende owner in plaats van foutief
        // "Round robin" te tonen wanneer de HubSpot API tijdelijk hapert.
        for (const contactId of batch) {
          const email = emailByContactId.get(contactId)
          if (email && ownersByEmail[email] === null) delete ownersByEmail[email]
        }
        console.error(`[HubSpot API] Leadbatch ${index / CONTACT_BATCH_SIZE + 1} mislukt:`, error)
      }
    }

    return ownersByEmail
  },
  ['hubspot-lead-owners-v3'],
  { revalidate: 30 },
)

const getCachedOwnerNames = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const ownerNames: Record<string, string> = {}
    let after: string | undefined
    let page = 0

    try {
      do {
        page += 1
        if (page > MAX_PAGES_PER_BATCH) throw new Error('HubSpot ownerpaginering overschreed de veiligheidslimiet')

        const searchParams = new URLSearchParams({ limit: '100' })
        if (after) searchParams.set('after', after)
        const payload = await fetchHubSpotJson<SearchResponse<HubSpotOwner>>(`/crm/v3/owners/?${searchParams}`)

        for (const owner of payload.results ?? []) {
          const id = owner.id?.trim()
          if (!id) continue
          const fullName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim()
          ownerNames[id] = fullName || owner.email?.trim() || id
        }
        after = payload.paging?.next?.after
      } while (after)
    } catch (error) {
      console.error('[HubSpot API] Ownernamen ophalen is gedeeltelijk mislukt:', error)
    }

    return ownerNames
  },
  ['hubspot-owner-names-v2'],
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
