import type { SupabaseClient } from '@supabase/supabase-js'

const HUBSPOT_API = 'https://api.hubapi.com'
const LEAD_PIPELINE_ID = '3961435370'
const LEAD_STAGE_PROPERTY = 'hs_pipeline_stage'
const WAITLIST_DISCOVERY_STAGE_ID = '6147230967'

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

type ReconciliationCandidate = {
  email: string
  trigger: LeadStageTrigger
}

type ContactWithEdition = HubSpotContact & {
  properties?: { email?: string | null; voorkeurseditie?: string | null }
}

const RECONCILIATION_PAGE_SIZE = 1000
const HUBSPOT_BATCH_SIZE = 100

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
}

async function readAllRows<T>(loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += RECONCILIATION_PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + RECONCILIATION_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < RECONCILIATION_PAGE_SIZE) return rows
  }
}

async function findEditionContacts(): Promise<ContactWithEdition[]> {
  const contacts: ContactWithEdition[] = []
  let after: string | undefined

  do {
    const result = await hubSpotRequest<{
      results?: ContactWithEdition[]
      paging?: { next?: { after?: string } }
    }>('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'voorkeurseditie', operator: 'HAS_PROPERTY' }] }],
        properties: ['email', 'voorkeurseditie'],
        limit: 100,
        ...(after ? { after } : {}),
      }),
    })
    contacts.push(...(result.results ?? []))
    after = result.paging?.next?.after
  } while (after)

  return contacts
}

export type HubSpotStageReconciliationResult = {
  candidates: number
  updated: number
  alreadyCorrect: number
  contactsMissing: number
  leadsMissing: number
  verificationFailed: number
}

export async function reconcileHubSpotLeadStages(supabase: SupabaseClient): Promise<HubSpotStageReconciliationResult> {
  const [{ data: coreVideos, error: videosError }, users, completedProgress, funnels, editionContacts] = await Promise.all([
    supabase.from('demo_invest_videos').select('id').eq('section', 'core'),
    readAllRows<{ id: string; email: string }>((from, to) => supabase.from('demo_invest_users').select('id, email').not('email', 'is', null).range(from, to)),
    readAllRows<{ user_id: string; video_id: string }>((from, to) => supabase.from('demo_invest_video_progress').select('user_id, video_id').eq('status', 'completed').range(from, to)),
    readAllRows<{ user_id: string; all_completed_at: string | null }>((from, to) => supabase.from('demo_invest_user_funnel').select('user_id, all_completed_at').range(from, to)),
    findEditionContacts(),
  ])
  if (videosError) throw new Error(videosError.message)

  const coreVideoIds = new Set((coreVideos ?? []).map(video => video.id))
  if (coreVideoIds.size === 0) throw new Error('Geen kernvideo’s gevonden voor HubSpot-reconciliatie')

  const completedByUser = new Map<string, number>()
  for (const row of completedProgress) {
    if (!coreVideoIds.has(row.video_id)) continue
    completedByUser.set(row.user_id, (completedByUser.get(row.user_id) ?? 0) + 1)
  }
  const allCompletedUsers = new Set(funnels.filter(funnel => Boolean(funnel.all_completed_at)).map(funnel => funnel.user_id))
  const candidateByEmail = new Map<string, ReconciliationCandidate>()

  for (const user of users) {
    const email = user.email.trim().toLowerCase()
    if (!email) continue
    const completedCount = completedByUser.get(user.id) ?? 0
    if (completedCount >= coreVideoIds.size || allCompletedUsers.has(user.id)) {
      candidateByEmail.set(email, { email, trigger: 'six_core_videos' })
    } else if (completedCount >= 1 && !candidateByEmail.has(email)) {
      candidateByEmail.set(email, { email, trigger: 'one_core_video' })
    }
  }

  const contactByEmail = new Map<string, ContactWithEdition>()
  for (const contact of editionContacts) {
    const email = contact.properties?.email?.trim().toLowerCase()
    if (!email) continue
    contactByEmail.set(email, contact)
    candidateByEmail.set(email, { email, trigger: 'edition_selected' })
  }

  const unresolvedEmails = Array.from(candidateByEmail.keys()).filter(email => !contactByEmail.has(email))
  for (const batch of chunks(unresolvedEmails, HUBSPOT_BATCH_SIZE)) {
    const response = await hubSpotRequest<{ results?: ContactWithEdition[] }>('/crm/v3/objects/contacts/batch/read', {
      method: 'POST',
      body: JSON.stringify({ idProperty: 'email', properties: ['email'], inputs: batch.map(id => ({ id })) }),
    })
    for (const contact of response.results ?? []) {
      const email = contact.properties?.email?.trim().toLowerCase()
      if (email) contactByEmail.set(email, contact)
    }
  }

  const emailByContactId = new Map(Array.from(contactByEmail.entries()).map(([email, contact]) => [contact.id, email]))
  const leadIdsByEmail = new Map<string, string[]>()
  for (const batch of chunks(Array.from(emailByContactId.keys()), HUBSPOT_BATCH_SIZE)) {
    const response = await hubSpotRequest<{ results?: HubSpotAssociation[] }>('/crm/v4/associations/contacts/leads/batch/read', {
      method: 'POST',
      body: JSON.stringify({ inputs: batch.map(id => ({ id })) }),
    })
    for (const association of response.results ?? []) {
      const email = emailByContactId.get(association.from.id)
      if (!email) continue
      leadIdsByEmail.set(email, (association.to ?? []).map(lead => String(lead.toObjectId ?? lead.id ?? '')).filter(Boolean))
    }
  }

  const uniqueLeadIds = Array.from(new Set(Array.from(leadIdsByEmail.values()).flat()))
  const leadById = new Map<string, HubSpotLead>()
  for (const batch of chunks(uniqueLeadIds, HUBSPOT_BATCH_SIZE)) {
    const response = await hubSpotRequest<{ results?: HubSpotLead[] }>('/crm/v3/objects/leads/batch/read', {
      method: 'POST',
      body: JSON.stringify({ properties: ['hs_pipeline', LEAD_STAGE_PROPERTY], inputs: batch.map(id => ({ id })) }),
    })
    for (const lead of response.results ?? []) leadById.set(lead.id, lead)
  }

  const updates: Array<{ id: string; properties: Record<string, string> }> = []
  let alreadyCorrect = 0
  let leadsMissing = 0

  for (const candidate of candidateByEmail.values()) {
    const lead = (leadIdsByEmail.get(candidate.email) ?? [])
      .map(id => leadById.get(id))
      .filter((item): item is HubSpotLead => item?.properties?.hs_pipeline === LEAD_PIPELINE_ID)
      .sort((first, second) => (second.updatedAt ?? '').localeCompare(first.updatedAt ?? ''))[0]
    if (!lead) {
      leadsMissing += 1
      continue
    }

    const targetStage = STAGE_BY_TRIGGER[candidate.trigger]
    const currentStage = lead.properties?.[LEAD_STAGE_PROPERTY] ?? null
    const currentOrder = currentStage ? stageOrder.get(currentStage) : undefined
    const targetOrder = stageOrder.get(targetStage)
    if (targetOrder === undefined || (currentOrder !== undefined && currentOrder >= targetOrder)) {
      alreadyCorrect += 1
      continue
    }
    updates.push({ id: lead.id, properties: { [LEAD_STAGE_PROPERTY]: targetStage } })
  }

  for (const batch of chunks(updates, HUBSPOT_BATCH_SIZE)) {
    await hubSpotRequest('/crm/v3/objects/leads/batch/update', {
      method: 'POST',
      body: JSON.stringify({ inputs: batch }),
    })
  }

  let verificationFailed = 0
  for (const batch of chunks(updates, HUBSPOT_BATCH_SIZE)) {
    const response = await hubSpotRequest<{ results?: HubSpotLead[] }>('/crm/v3/objects/leads/batch/read', {
      method: 'POST',
      body: JSON.stringify({ properties: [LEAD_STAGE_PROPERTY], inputs: batch.map(update => ({ id: update.id })) }),
    })
    const verifiedStages = new Map((response.results ?? []).map(lead => [lead.id, lead.properties?.[LEAD_STAGE_PROPERTY]]))
    verificationFailed += batch.filter(update => verifiedStages.get(update.id) !== update.properties[LEAD_STAGE_PROPERTY]).length
  }

  if (verificationFailed > 0) throw new Error(`${verificationFailed} HubSpot-stageupdates konden niet worden bevestigd`)

  return {
    candidates: candidateByEmail.size,
    updated: updates.length,
    alreadyCorrect,
    contactsMissing: unresolvedEmails.filter(email => !contactByEmail.has(email)).length,
    leadsMissing,
    verificationFailed,
  }
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
