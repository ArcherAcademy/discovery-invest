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
  { id: '5709325548', label: 'Workshop / Event', displayOrder: 13 },
  { id: '5709325552', label: 'Sales Qualified', displayOrder: 14 },
  { id: '5709325549', label: 'Marketing Qualified', displayOrder: 15 },
  { id: '5706792164', label: 'Qualified', displayOrder: 16 },
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
      const fallbackDelay = response.status === 429 ? 11_000 : 500 * (attempt + 1)
      await new Promise(resolve => setTimeout(
        resolve,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : fallbackDelay,
      ))
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

export async function mergeDuplicateHubSpotLeads(maxArchivedLeads = 50) {
  const leads: HubSpotLead[] = []
  let after: string | undefined

  do {
    const page = await hubSpotRequest<{
      results?: HubSpotLead[]
      paging?: { next?: { after?: string } }
    }>('/crm/v3/objects/leads/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'hs_pipeline', operator: 'EQ', value: LEAD_PIPELINE_ID }] }],
        properties: ['hs_pipeline', LEAD_STAGE_PROPERTY, 'hs_createdate'],
        limit: 200,
        ...(after ? { after } : {}),
      }),
    })
    leads.push(...(page.results ?? []))
    after = page.paging?.next?.after
  } while (after)

  const leadById = new Map(leads.map(lead => [lead.id, lead]))
  const leadsByContact = new Map<string, HubSpotLead[]>()
  for (const leadBatch of inChunks(leads)) {
    const associations = await hubSpotRequest<{ results?: HubSpotAssociation[] }>(
      '/crm/v4/associations/leads/contacts/batch/read',
      { method: 'POST', body: JSON.stringify({ inputs: leadBatch.map(lead => ({ id: lead.id })) }) },
    )
    for (const association of associations.results ?? []) {
      const lead = leadById.get(String(association.from.id))
      const contactId = String(association.to?.[0]?.toObjectId ?? association.to?.[0]?.id ?? '')
      if (!lead || !contactId) continue
      const group = leadsByContact.get(contactId) ?? []
      group.push(lead)
      leadsByContact.set(contactId, group)
    }
  }

  let duplicateGroups = 0
  let archivedLeads = 0
  let promotedPrimaryLeads = 0
  for (const group of leadsByContact.values()) {
    const uniqueGroup = [...new Map(group.map(lead => [lead.id, lead])).values()]
    if (uniqueGroup.length < 2) continue
    duplicateGroups += 1
    uniqueGroup.sort((first, second) => {
      const firstCreatedAt = first.properties?.hs_createdate ?? ''
      const secondCreatedAt = second.properties?.hs_createdate ?? ''
      return firstCreatedAt.localeCompare(secondCreatedAt) || Number(first.id) - Number(second.id)
    })

    const [primaryLead, ...duplicates] = uniqueGroup
    const duplicateBatch = duplicates.slice(0, Math.max(0, maxArchivedLeads - archivedLeads))
    if (duplicateBatch.length === 0) break

    const furthestLead = uniqueGroup.reduce((furthest, lead) => {
      const furthestOrder = stageOrder.get(furthest.properties?.[LEAD_STAGE_PROPERTY] ?? '') ?? -1
      const leadOrder = stageOrder.get(lead.properties?.[LEAD_STAGE_PROPERTY] ?? '') ?? -1
      return leadOrder > furthestOrder ? lead : furthest
    }, primaryLead)
    const furthestStage = furthestLead.properties?.[LEAD_STAGE_PROPERTY]
    if (furthestStage && furthestStage !== primaryLead.properties?.[LEAD_STAGE_PROPERTY]) {
      await hubSpotRequest(`/crm/v3/objects/leads/${primaryLead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties: { [LEAD_STAGE_PROPERTY]: furthestStage } }),
      })
      promotedPrimaryLeads += 1
    }

    await hubSpotRequest('/crm/v3/objects/leads/batch/archive', {
      method: 'POST',
      body: JSON.stringify({ inputs: duplicateBatch.map(lead => ({ id: lead.id })) }),
    })
    archivedLeads += duplicateBatch.length
    if (archivedLeads >= maxArchivedLeads) break
  }

  return {
    scannedLeads: leads.length,
    duplicateGroups,
    archivedLeads,
    promotedPrimaryLeads,
    limitReached: archivedLeads >= maxArchivedLeads,
  }
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
