const HUBSPOT_API = 'https://api.hubapi.com'
const LEAD_PIPELINE_ID = '3961435370'
const LEAD_STAGE_PROPERTY = 'hs_pipeline_stage'
const WAITLIST_DISCOVERY_STAGE_ID = '6147230967'
const NEWSLETTER_STAGE_IDS = ['6161831098', '5709325549'] as const
const NEWSLETTER_CONTACT_PROPERTY = 'nieuwsbrief_leads_nl_via_archer_invest'

const STAGE_BY_TRIGGER = {
  one_core_video: '6150881500',
  six_core_videos: '6147230966',
  edition_selected: WAITLIST_DISCOVERY_STAGE_ID,
} as const

type LeadStageTrigger = keyof typeof STAGE_BY_TRIGGER

type HubSpotLead = {
  id: string
  properties?: Record<string, string | null>
  updatedAt?: string
}

type HubSpotContact = { id: string; properties?: { email?: string | null } }

type HubSpotAssociation = {
  from: { id: string }
  to?: Array<{ toObjectId?: string; id?: string }>
}

type StageDefinition = { id: string; label: string; displayOrder: number }

const stageDefinitions: StageDefinition[] = [
  { id: '5706792162', label: 'New Lead Ads', displayOrder: 0 },
  { id: '5849884862', label: 'Vermogens-Test', displayOrder: 1 },
  { id: '5779412163', label: 'Discovery Invest', displayOrder: 2 },
  { id: '6147228875', label: 'Attempted To Contact (Lead)', displayOrder: 3 },
  { id: '6147228876', label: 'Contacted (Lead)', displayOrder: 4 },
  { id: '6161831098', label: 'Lead: No Contact', displayOrder: 5 },
  { id: '6150881500', label: 'Qualified (1/6)', displayOrder: 6 },
  { id: '6147230966', label: 'Qualified 6/6', displayOrder: 7 },
  { id: '6147230967', label: 'Waitlist Discovery', displayOrder: 8 },
  { id: '5938491641', label: 'Waitlist Website', displayOrder: 9 },
  { id: '5706792163', label: 'Attempted To Contact', displayOrder: 10 },
  { id: '5709325551', label: 'Contacted', displayOrder: 11 },
  { id: '5706792165', label: '1-1 Meeting', displayOrder: 12 },
  { id: '5709325552', label: 'Sales Qualified', displayOrder: 13 },
  { id: '5709325549', label: 'Marketing Qualified', displayOrder: 14 },
  { id: '5706792164', label: 'Qualified', displayOrder: 15 },
  { id: '5709325548', label: 'Workshop / Event', displayOrder: 16 },
  { id: '5709325554', label: 'Not Qualified', displayOrder: 17 },
  { id: '5709325555', label: 'Newsletter Anthony', displayOrder: 18 },
  { id: '5709325553', label: 'Fund Qualified', displayOrder: 19 },
]

const stageOrder = new Map(stageDefinitions.map(stage => [stage.id, stage.displayOrder]))

function getToken() {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN ontbreekt')
  return token
}

async function hubSpotRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${HUBSPOT_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })

    if (response.ok) {
      if (response.status === 204) return undefined as T
      return response.json() as Promise<T>
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'))
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * (attempt + 1)))
      continue
    }

    const body = await response.text()
    throw new Error(`HubSpot API ${response.status}: ${body.slice(0, 500)}`)
  }

  throw new Error('HubSpot API kon niet worden bereikt')
}

async function findLeadForEmail(email: string): Promise<HubSpotLead | null> {
  const contactData = await hubSpotRequest<{ results?: HubSpotContact[] }>('/crm/v3/objects/contacts/batch/read', {
    method: 'POST',
    body: JSON.stringify({
      idProperty: 'email',
      properties: ['email'],
      inputs: [{ id: email.trim().toLowerCase() }],
    }),
  })
  const contact = contactData.results?.[0]
  if (!contact) return null

  const associations = await hubSpotRequest<{ results?: HubSpotAssociation[] }>(
    '/crm/v4/associations/contacts/leads/batch/read',
    { method: 'POST', body: JSON.stringify({ inputs: [{ id: contact.id }] }) },
  )
  const leadIds = Array.from(new Set((associations.results ?? []).flatMap(association => association.to ?? [])
    .map(lead => String(lead.toObjectId ?? lead.id ?? ''))
    .filter(Boolean)))
  if (leadIds.length === 0) return null

  const leads = await hubSpotRequest<{ results?: HubSpotLead[] }>('/crm/v3/objects/leads/batch/read', {
    method: 'POST',
    body: JSON.stringify({
      properties: ['hs_pipeline', LEAD_STAGE_PROPERTY],
      inputs: leadIds.map(id => ({ id })),
    }),
  })

  return (leads.results ?? [])
    .filter(lead => lead.properties?.hs_pipeline === LEAD_PIPELINE_ID)
    .sort((first, second) => (second.updatedAt ?? '').localeCompare(first.updatedAt ?? ''))[0] ?? null
}

function inChunks<T>(items: T[], size = 100) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  )
}

type MergeableHubSpotContact = {
  id: string
  createdAt?: string
  properties?: Record<string, string | null>
}

function normalizeContactName(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase('nl-BE').replace(/\s+/g, ' ')
}

function normalizeBelgianPhone(value?: string | null) {
  let digits = (value ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length >= 9) digits = `32${digits.slice(1)}`
  return digits
}

export async function mergeDuplicateHubSpotContacts(maxMerges = 50) {
  const contacts: MergeableHubSpotContact[] = []
  let after: string | undefined

  do {
    const query = new URLSearchParams({
      limit: '100',
      properties: 'firstname,lastname,phone,mobilephone,createdate',
      archived: 'false',
    })
    if (after) query.set('after', after)

    const page = await hubSpotRequest<{
      results?: MergeableHubSpotContact[]
      paging?: { next?: { after?: string } }
    }>(`/crm/v3/objects/contacts?${query.toString()}`)
    contacts.push(...(page.results ?? []))
    after = page.paging?.next?.after
  } while (after)

  const groups = new Map<string, MergeableHubSpotContact[]>()
  for (const contact of contacts) {
    const firstName = normalizeContactName(contact.properties?.firstname)
    const lastName = normalizeContactName(contact.properties?.lastname)
    const phone = normalizeBelgianPhone(contact.properties?.phone || contact.properties?.mobilephone)
    if (!firstName || !lastName || phone.length < 9) continue

    const key = `${firstName}|${lastName}|${phone}`
    const group = groups.get(key) ?? []
    group.push(contact)
    groups.set(key, group)
  }

  let mergedContacts = 0
  let duplicateGroups = 0
  for (const group of groups.values()) {
    if (group.length < 2) continue
    duplicateGroups += 1
    group.sort((first, second) => {
      const firstCreatedAt = first.properties?.createdate ?? first.createdAt ?? ''
      const secondCreatedAt = second.properties?.createdate ?? second.createdAt ?? ''
      return firstCreatedAt.localeCompare(secondCreatedAt) || Number(first.id) - Number(second.id)
    })

    const [primaryContact, ...duplicates] = group
    for (const duplicate of duplicates) {
      if (mergedContacts >= maxMerges) {
        return { scannedContacts: contacts.length, duplicateGroups, mergedContacts, limitReached: true }
      }
      await hubSpotRequest('/crm/objects/2026-09/contacts/merge', {
        method: 'POST',
        body: JSON.stringify({
          primaryObjectId: primaryContact.id,
          objectIdToMerge: duplicate.id,
        }),
      })
      mergedContacts += 1
    }
  }

  return { scannedContacts: contacts.length, duplicateGroups, mergedContacts, limitReached: false }
}

export async function syncHubSpotNewsletterSegment() {
  const leads: HubSpotLead[] = []
  let after: string | undefined

  do {
    const page = await hubSpotRequest<{
      results?: HubSpotLead[]
      paging?: { next?: { after?: string } }
    }>('/crm/v3/objects/leads/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [
            { propertyName: 'hs_pipeline', operator: 'EQ', value: LEAD_PIPELINE_ID },
            { propertyName: LEAD_STAGE_PROPERTY, operator: 'IN', values: NEWSLETTER_STAGE_IDS },
          ],
        }],
        properties: ['hs_pipeline', LEAD_STAGE_PROPERTY],
        limit: 200,
        ...(after ? { after } : {}),
      }),
    })
    leads.push(...(page.results ?? []))
    after = page.paging?.next?.after
  } while (after)

  const contactIds = new Set<string>()
  for (const leadBatch of inChunks(leads)) {
    const associations = await hubSpotRequest<{ results?: HubSpotAssociation[] }>(
      '/crm/v4/associations/leads/contacts/batch/read',
      { method: 'POST', body: JSON.stringify({ inputs: leadBatch.map(lead => ({ id: lead.id })) }) },
    )
    for (const association of associations.results ?? []) {
      for (const contact of association.to ?? []) {
        const contactId = String(contact.toObjectId ?? contact.id ?? '')
        if (contactId) contactIds.add(contactId)
      }
    }
  }

  const contacts: Array<{ id: string; properties?: Record<string, string | null> }> = []
  for (const contactBatch of inChunks([...contactIds])) {
    const result = await hubSpotRequest<{
      results?: Array<{ id: string; properties?: Record<string, string | null> }>
    }>('/crm/v3/objects/contacts/batch/read', {
      method: 'POST',
      body: JSON.stringify({
        properties: [NEWSLETTER_CONTACT_PROPERTY],
        inputs: contactBatch.map(id => ({ id })),
      }),
    })
    contacts.push(...(result.results ?? []))
  }

  const contactsToMark = contacts.filter(
    contact => contact.properties?.[NEWSLETTER_CONTACT_PROPERTY] !== 'true',
  )
  for (const contactBatch of inChunks(contactsToMark)) {
    await hubSpotRequest('/crm/v3/objects/contacts/batch/update', {
      method: 'POST',
      body: JSON.stringify({
        inputs: contactBatch.map(contact => ({
          id: contact.id,
          properties: { [NEWSLETTER_CONTACT_PROPERTY]: 'true' },
        })),
      }),
    })
  }

  return {
    matchingLeads: leads.length,
    associatedContacts: contactIds.size,
    newlyMarkedContacts: contactsToMark.length,
  }
}

export async function advanceHubSpotLeadStageById(leadId: string, trigger: LeadStageTrigger): Promise<{
  updated: boolean
  leadId: string
  fromStage: string | null
  toStage: string
  reason?: string
}> {
  const targetStage = STAGE_BY_TRIGGER[trigger]
  const lead = await hubSpotRequest<HubSpotLead>(`/crm/v3/objects/leads/${encodeURIComponent(leadId)}?properties=${LEAD_STAGE_PROPERTY},hs_pipeline`)
  if (lead.properties?.hs_pipeline !== LEAD_PIPELINE_ID) {
    return { updated: false, leadId, fromStage: lead.properties?.[LEAD_STAGE_PROPERTY] ?? null, toStage: targetStage, reason: 'lead_not_in_archer_pipeline' }
  }
  const currentStage = lead.properties?.[LEAD_STAGE_PROPERTY] ?? null
  const currentOrder = currentStage ? stageOrder.get(currentStage) : undefined
  const targetOrder = stageOrder.get(targetStage)
  if (targetOrder === undefined || (currentOrder !== undefined && currentOrder >= targetOrder)) {
    return { updated: false, leadId, fromStage: currentStage, toStage: targetStage, reason: 'already_at_or_beyond_target' }
  }
  await hubSpotRequest(`/crm/v3/objects/leads/${encodeURIComponent(leadId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: { [LEAD_STAGE_PROPERTY]: targetStage } }),
  })
  return { updated: true, leadId, fromStage: currentStage, toStage: targetStage }
}

export async function advanceHubSpotLeadStage(email: string, trigger: LeadStageTrigger): Promise<{
  updated: boolean
  leadId: string | null
  fromStage: string | null
  toStage: string
  reason?: string
}> {
  const targetStage = STAGE_BY_TRIGGER[trigger]
  const lead = await findLeadForEmail(email)
  if (!lead) return { updated: false, leadId: null, fromStage: null, toStage: targetStage, reason: 'lead_not_found_in_archer_pipeline' }

  const currentStage = lead.properties?.[LEAD_STAGE_PROPERTY] ?? null
  const currentOrder = currentStage ? stageOrder.get(currentStage) : undefined
  const targetOrder = stageOrder.get(targetStage)
  if (targetOrder === undefined || (currentOrder !== undefined && currentOrder >= targetOrder)) {
    return { updated: false, leadId: lead.id, fromStage: currentStage, toStage: targetStage, reason: 'already_at_or_beyond_target' }
  }

  await hubSpotRequest(`/crm/v3/objects/leads/${encodeURIComponent(lead.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: { [LEAD_STAGE_PROPERTY]: targetStage } }),
  })

  return { updated: true, leadId: lead.id, fromStage: currentStage, toStage: targetStage }
}

export async function ensureHubSpotLeadStage(email: string, trigger: LeadStageTrigger) {
  const result = await advanceHubSpotLeadStage(email, trigger)
  if (!result.leadId) {
    throw new Error(`Geen gekoppelde Discovery-lead gevonden voor ${email}`)
  }
  if (!result.updated && result.reason !== 'already_at_or_beyond_target') {
    throw new Error(`HubSpot-stage niet bijgewerkt: ${result.reason ?? 'onbekende reden'}`)
  }

  const targetOrder = stageOrder.get(result.toStage)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const verifiedLead = await hubSpotRequest<HubSpotLead>(
      `/crm/v3/objects/leads/${encodeURIComponent(result.leadId)}?properties=${LEAD_STAGE_PROPERTY}`,
    )
    const verifiedStage = verifiedLead.properties?.[LEAD_STAGE_PROPERTY] ?? null
    const verifiedOrder = verifiedStage ? stageOrder.get(verifiedStage) : undefined
    if (targetOrder !== undefined && verifiedOrder !== undefined && verifiedOrder >= targetOrder) {
      return { ...result, verifiedStage }
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
  }

  throw new Error(`HubSpot bevestigde stage ${result.toStage} niet voor lead ${result.leadId}`)
}

export function isLeadStageTrigger(value: string): value is LeadStageTrigger {
  return value in STAGE_BY_TRIGGER
}

export const HUBSPOT_LEAD_STAGE_CONFIG = {
  pipelineId: LEAD_PIPELINE_ID,
  stageProperty: LEAD_STAGE_PROPERTY,
  stages: STAGE_BY_TRIGGER,
  waitlistDiscoveryStageId: WAITLIST_DISCOVERY_STAGE_ID,
} as const
