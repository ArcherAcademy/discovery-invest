export interface HubSpotOwner {
  id: string
  name: string
  email: string | null
  team: string | null
}

const HUBSPOT_OWNERS: readonly HubSpotOwner[] = [
  { id: '319840496', name: 'Anthony Swolfs', email: 'anthony@archer.academy', team: 'Management' },
  { id: '320716249', name: 'Armani-Rochas Decock', email: 'armanirochas@gmail.com', team: 'Management' },
  { id: '458827458', name: 'Bjorn Cornelissens', email: 'bjorn@archer.academy', team: 'Management' },
  { id: '320716258', name: 'Nicolas Neuville', email: 'nicolas@archer.academy', team: 'Mentors' },
  { id: '320716524', name: 'Kevin Peeters', email: 'kevin@archer.academy', team: 'Mentors' },
  { id: '31191383', name: 'Wout Lambrecht', email: 'wout@archer.finance', team: 'Mentors' },
  { id: '414511835', name: 'Jietse Strubbe', email: 'jietse@archer.academy', team: 'Mentors' },
  { id: '873918168', name: 'Nigel Bertrams', email: 'nigel@archer.academy', team: 'Mentors' },
  { id: '1359346636', name: 'Xavier Goethals', email: 'xavier@archer.academy', team: 'Mentors' },
  { id: '1385035769', name: 'Lennard Van Hecke', email: 'lennard@archer.academy', team: 'Mentors' },
  { id: '31313067', name: 'Stijn De Vos', email: 'stijn@archer.finance', team: 'Consultants' },
  { id: '35791569', name: 'Pieter de Smet', email: 'pieter@archer.finance', team: 'Consultants' },
  { id: '36112549', name: 'Lucas Alloing', email: 'lucas@archer.finance', team: 'Consultants' },
  { id: '78151098', name: 'Creneau Rotsaert', email: 'creneau@archer.academy', team: 'Consultants' },
  { id: '29636574', name: 'Ward buyse', email: 'ward@archer.academy', team: 'Product' },
  { id: '32712616', name: 'Sophie Bielen', email: 'sophie@archer.finance', team: 'Product' },
  { id: '768601327', name: 'Victor Matheussen', email: 'victor@archer.academy', team: 'Product' },
  { id: '35973861', name: 'Caroline Maes', email: 'caroline@archer.finance', team: 'Events' },
  { id: '795819249', name: 'Rha Demets', email: 'rha@archer.academy', team: 'Finance' },
  { id: '33233361', name: 'Yannick Heraly', email: 'yannick@archer.finance', team: null },
  { id: '34518213', name: 'Maxim Schuermans', email: 'maxim@archer.finance', team: null },
  { id: '1092561603', name: 'Archer Academy', email: 'info@archer.academy', team: 'Support' },
]

const ownersById = new Map(HUBSPOT_OWNERS.map(owner => [owner.id, owner]))

const OWNER_ID_KEYS = [
  'hubspot_owner_id',
  'contact_owner_id',
  'owner_id',
  'contacteigenaar_id',
  '_hubspot_owner_id',
] as const

function scalarText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return scalarText((value as { value?: unknown }).value)
  }
  return ''
}

export function extractHubSpotOwnerId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const body = payload as Record<string, unknown>
  const properties = body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
    ? body.properties as Record<string, unknown>
    : null

  for (const source of [body, properties]) {
    if (!source) continue
    for (const key of OWNER_ID_KEYS) {
      const candidate = scalarText(source[key])
      if (/^\d+$/.test(candidate)) return candidate
    }
  }

  return null
}

export function getHubSpotOwner(ownerId: string | null | undefined): HubSpotOwner | null {
  const normalizedId = typeof ownerId === 'string' ? ownerId.trim() : ''
  return normalizedId ? ownersById.get(normalizedId) ?? null : null
}

export function getHubSpotOwnerName(ownerId: string | null | undefined, fallback: string | null = null): string | null {
  return getHubSpotOwner(ownerId)?.name ?? fallback
}

interface HubSpotContactSearchResult {
  id: string
  properties?: {
    email?: string | null
    hubspot_owner_id?: string | null
    phone?: string | null
    mobilephone?: string | null
  }
}

interface HubSpotAssociationResult {
  from: { id: string }
  to?: { toObjectId?: number; id?: string }[]
}

interface HubSpotLeadResult {
  id: string
  updatedAt?: string
  properties?: {
    hubspot_owner_id?: string | null
    hs_owner_id_calculated?: string | null
    hs_all_owner_ids?: string | null
  }
}

interface HubSpotOwnerResult {
  id: string
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  teams?: { name?: string | null }[]
}

export interface HubSpotAccountOwnerSnapshot {
  ownerIdByEmail: Map<string, string | null>
  phoneByEmail: Map<string, string | null>
  ownersById: Map<string, HubSpotOwner>
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))

async function hubSpotRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN ontbreekt')

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.hubapi.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })

    if (response.ok) return response.json() as Promise<T>

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'))
      await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 500 * (attempt + 1))
      continue
    }

    const body = await response.text()
    throw new Error(`HubSpot API ${response.status}: ${body.slice(0, 300)}`)
  }

  throw new Error('HubSpot API kon niet worden bereikt')
}

export async function getHubSpotAccountOwnerSnapshot(emails: string[]): Promise<HubSpotAccountOwnerSnapshot> {
  const normalizedEmails = Array.from(new Set(emails.map(email => email.trim().toLowerCase()).filter(Boolean)))
  const ownerIdByEmail = new Map<string, string | null>()
  const phoneByEmail = new Map<string, string | null>()
  const dynamicOwnersById = new Map<string, HubSpotOwner>()
  const emailByContactId = new Map<string, string>()
  const leadIdsByContactId = new Map<string, string[]>()

  for (let index = 0; index < normalizedEmails.length; index += 100) {
    const values = normalizedEmails.slice(index, index + 100)
    const data = await hubSpotRequest<{ results?: HubSpotContactSearchResult[] }>('/crm/v3/objects/contacts/batch/read', {
      method: 'POST',
      body: JSON.stringify({
        idProperty: 'email',
        properties: ['email', 'hubspot_owner_id', 'phone', 'mobilephone'],
        propertiesWithHistory: [],
        inputs: values.map(id => ({ id })),
      }),
    })

    const contacts = data.results ?? []
    for (const contact of contacts) {
      const email = contact.properties?.email?.trim().toLowerCase()
      if (!email) continue
      const ownerId = contact.properties?.hubspot_owner_id?.trim() || null
      const phone = contact.properties?.mobilephone?.trim() || contact.properties?.phone?.trim() || null
      ownerIdByEmail.set(email, ownerId)
      phoneByEmail.set(email, phone)
      emailByContactId.set(contact.id, email)
    }

    if (contacts.length > 0) {
      const associations = await hubSpotRequest<{ results?: HubSpotAssociationResult[] }>(
        '/crm/v4/associations/contacts/leads/batch/read',
        {
          method: 'POST',
          body: JSON.stringify({ inputs: contacts.map(contact => ({ id: contact.id })) }),
        },
      )

      for (const association of associations.results ?? []) {
        const leadIds = (association.to ?? [])
          .map(lead => String(lead.toObjectId ?? lead.id ?? ''))
          .filter(Boolean)
        if (leadIds.length > 0) leadIdsByContactId.set(association.from.id, leadIds)
      }
    }

    // Houd de requests onder HubSpots secondly limiet, ook bij 1.000+ accounts.
    if (index + 100 < normalizedEmails.length) await wait(150)
  }

  const uniqueLeadIds = Array.from(new Set(Array.from(leadIdsByContactId.values()).flat()))
  const leadsById = new Map<string, HubSpotLeadResult>()
  for (let index = 0; index < uniqueLeadIds.length; index += 100) {
    const leadIds = uniqueLeadIds.slice(index, index + 100)
    const data = await hubSpotRequest<{ results?: HubSpotLeadResult[] }>('/crm/v3/objects/leads/batch/read', {
      method: 'POST',
      body: JSON.stringify({
        properties: ['hubspot_owner_id', 'hs_owner_id_calculated', 'hs_all_owner_ids'],
        propertiesWithHistory: [],
        inputs: leadIds.map(id => ({ id })),
      }),
    })
    for (const lead of data.results ?? []) leadsById.set(lead.id, lead)
    if (index + 100 < uniqueLeadIds.length) await wait(150)
  }

  for (const [contactId, leadIds] of leadIdsByContactId) {
    const email = emailByContactId.get(contactId)
    if (!email) continue

    const newestLeadWithOwner = leadIds
      .map(leadId => leadsById.get(leadId))
      .filter((lead): lead is HubSpotLeadResult => Boolean(lead))
      .sort((first, second) => (second.updatedAt ?? '').localeCompare(first.updatedAt ?? ''))
      .find(lead => Boolean(
        lead.properties?.hubspot_owner_id?.trim()
        || lead.properties?.hs_owner_id_calculated?.trim()
        || lead.properties?.hs_all_owner_ids?.split(';')[0]?.trim(),
      ))

    const leadOwnerId = newestLeadWithOwner?.properties?.hubspot_owner_id?.trim()
      || newestLeadWithOwner?.properties?.hs_owner_id_calculated?.trim()
      || newestLeadWithOwner?.properties?.hs_all_owner_ids?.split(';')[0]?.trim()
      || null

    if (leadOwnerId) ownerIdByEmail.set(email, leadOwnerId)
  }

  let after: string | undefined
  do {
    const query = new URLSearchParams({ limit: '100', archived: 'false' })
    if (after) query.set('after', after)
    const data = await hubSpotRequest<{
      results?: HubSpotOwnerResult[]
      paging?: { next?: { after?: string } }
    }>(`/crm/v3/owners/?${query.toString()}`)

    for (const owner of data.results ?? []) {
      const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email?.trim() || owner.id
      dynamicOwnersById.set(owner.id, {
        id: owner.id,
        name,
        email: owner.email?.trim() || null,
        team: owner.teams?.map(team => team.name).filter(Boolean).join(', ') || null,
      })
    }
    after = data.paging?.next?.after
  } while (after)

  return { ownerIdByEmail, phoneByEmail, ownersById: dynamicOwnersById }
}

export { HUBSPOT_OWNERS }

export default HUBSPOT_OWNERS

// Keep the catalog immutable at runtime so owner routing cannot be changed by a request.
Object.freeze(HUBSPOT_OWNERS)
for (const owner of HUBSPOT_OWNERS) Object.freeze(owner)
