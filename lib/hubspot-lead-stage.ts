const HUBSPOT_API = 'https://api.hubapi.com'
const LEAD_PIPELINE_ID = '3961435370'
const LEAD_STAGE_PROPERTY = 'hs_pipeline_stage'
const WAITLIST_DISCOVERY_STAGE_ID = '6147230967'

const STAGE_BY_TRIGGER = {
  two_core_videos: '6150881500',
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
  { id: '6150881500', label: 'Qualified (2/6)', displayOrder: 5 },
  { id: '6147230966', label: 'Qualified 6/6', displayOrder: 6 },
  { id: '5938491641', label: 'Waitlist Website', displayOrder: 8 },
  { id: '5706792163', label: 'Attempted To Contact', displayOrder: 9 },
  { id: '5709325551', label: 'Contacted', displayOrder: 10 },
  { id: '5706792165', label: '1-1 Meeting', displayOrder: 11 },
  { id: '5709325552', label: 'Sales Qualified', displayOrder: 12 },
  { id: '5709325549', label: 'Marketing Qualified', displayOrder: 13 },
  { id: '5706792164', label: 'Qualified', displayOrder: 14 },
  { id: '6147230967', label: 'Waitlist Discovery', displayOrder: 7 },
  { id: '5709325548', label: 'Workshop / Event', displayOrder: 15 },
  { id: '5709325554', label: 'Not Qualified', displayOrder: 16 },
  { id: '5709325555', label: 'Newsletter Anthony', displayOrder: 17 },
  { id: '5709325553', label: 'Fund Qualified', displayOrder: 18 },
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

export function isLeadStageTrigger(value: string): value is LeadStageTrigger {
  return value in STAGE_BY_TRIGGER
}

export const HUBSPOT_LEAD_STAGE_CONFIG = {
  pipelineId: LEAD_PIPELINE_ID,
  stageProperty: LEAD_STAGE_PROPERTY,
  stages: STAGE_BY_TRIGGER,
  waitlistDiscoveryStageId: WAITLIST_DISCOVERY_STAGE_ID,
} as const
