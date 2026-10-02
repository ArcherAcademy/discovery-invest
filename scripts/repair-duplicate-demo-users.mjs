import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) throw new Error('Supabase-omgeving ontbreekt.')

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
const statusRank = { not_started: 0, in_progress: 1, completed: 2 }
const roleRank = { user: 0, mentor: 1, admin: 2 }

const earliest = values => values.filter(Boolean).sort()[0] ?? null
const latest = values => values.filter(Boolean).sort().at(-1) ?? null
const strongestRole = users => [...users].sort((a, b) => (roleRank[b.role] ?? 0) - (roleRank[a.role] ?? 0))[0]?.role ?? 'user'

async function allRows(table, columns = '*') {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
    if (error) throw new Error(`${table} ophalen mislukt: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const tableRows = new Map()
let relevantUserIds = []

async function rowsForUsers(table, column, userIds) {
  if (!tableRows.has(table)) {
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').in(column, relevantUserIds).range(from, from + 999)
      if (error) throw new Error(`${table} ophalen mislukt: ${error.message}`)
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    tableRows.set(table, rows)
  }
  const ids = new Set(userIds)
  return tableRows.get(table).filter(row => ids.has(row[column]))
}

async function repairArchivedTriggerLogs(users) {
  const archived = users.filter(user => user.email?.endsWith('@invalid.archer.local'))
  if (!archived.length) return 0
  const canonicalByEmail = new Map(
    users
      .filter(user => user.email && !user.email.endsWith('@invalid.archer.local'))
      .map(user => [user.email.trim().toLowerCase(), user]),
  )
  let repaired = 0
  for (const source of archived) {
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('demo_invest_trigger_log')
        .select('*')
        .eq('user_id', source.id)
        .range(from, from + 999)
      if (error) throw new Error(`Historische triggerlogs ophalen mislukt: ${error.message}`)
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    if (!rows.length) continue
    const canonical = canonicalByEmail.get(rows[0].contact_email.trim().toLowerCase())
    if (!canonical) throw new Error(`Geen canonieke gebruiker gevonden voor gearchiveerde triggerlogs van ${source.id}`)
    for (let index = 0; index < rows.length; index += 250) {
      const batch = rows.slice(index, index + 250).map(row => ({ ...row, user_id: canonical.id }))
      const { error: upsertError } = await supabase
        .from('demo_invest_trigger_log')
        .upsert(batch, { onConflict: 'id' })
      if (upsertError) throw new Error(`Historische triggerlogs herstellen mislukt: ${upsertError.message}`)
    }
    repaired += rows.length
  }
  return repaired
}

async function deleteByIds(table, ids) {
  if (!ids.length) return
  const { error } = await supabase.from(table).delete().in('id', ids)
  if (error) throw new Error(`${table} verwijderen mislukt: ${error.message}`)
}

async function moveRows(table, column, sourceIds, canonicalId, idColumn = 'id') {
  const rows = await rowsForUsers(table, column, sourceIds)
  for (const row of rows) {
    const rowId = row[idColumn]
    const { error } = await supabase.from(table).update({ [column]: canonicalId }).eq(idColumn, rowId)
    if (!error) continue
    if (error.code !== '23505') throw new Error(`${table} overzetten mislukt: ${error.message}`)
    const { error: deleteError } = await supabase.from(table).delete().eq(idColumn, rowId)
    if (deleteError) throw new Error(`${table} dubbel verwijderen mislukt: ${deleteError.message}`)
  }
}

function canonicalUser(users) {
  return [...users].sort((a, b) => {
    const permanent = (roleRank[b.role] > 0 ? 1 : 0) - (roleRank[a.role] > 0 ? 1 : 0)
    if (permanent) return permanent
    const activated = Number(Boolean(b.activated_at)) - Number(Boolean(a.activated_at))
    if (activated) return activated
    const expiry = (Date.parse(b.trial_expires_at ?? '') || 0) - (Date.parse(a.trial_expires_at ?? '') || 0)
    if (expiry) return expiry
    return (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0)
  })[0]
}

async function mergeProgress(allIds, sourceIds, canonicalId) {
  const rows = await rowsForUsers('demo_invest_video_progress', 'user_id', allIds)
  const byVideo = new Map()
  for (const row of rows) {
    const current = byVideo.get(row.video_id)
    if (!current || (statusRank[row.status] ?? 0) > (statusRank[current.status] ?? 0) || row.progress_pct > current.progress_pct) {
      byVideo.set(row.video_id, row)
    }
  }
  await deleteByIds('demo_invest_video_progress', rows.map(row => row.id))
  for (const row of byVideo.values()) {
    const merged = {
      ...row,
      user_id: canonicalId,
      progress_pct: Math.max(...rows.filter(item => item.video_id === row.video_id).map(item => item.progress_pct)),
      started_at: earliest(rows.filter(item => item.video_id === row.video_id).map(item => item.started_at)),
      completed_at: latest(rows.filter(item => item.video_id === row.video_id).map(item => item.completed_at)),
      last_activity_at: latest(rows.filter(item => item.video_id === row.video_id).map(item => item.last_activity_at)),
      updated_at: latest(rows.filter(item => item.video_id === row.video_id).map(item => item.updated_at)),
    }
    const { error } = await supabase.from('demo_invest_video_progress').insert(merged)
    if (error) throw new Error(`Videovoortgang samenvoegen mislukt: ${error.message}`)
  }
}

async function mergeFunnel(allIds, canonicalId) {
  const rows = await rowsForUsers('demo_invest_user_funnel', 'user_id', allIds)
  if (!rows.length) return
  await deleteByIds('demo_invest_user_funnel', rows.map(row => row.id))
  const newest = [...rows].sort((a, b) => (Date.parse(b.updated_at ?? '') || 0) - (Date.parse(a.updated_at ?? '') || 0))[0]
  const merged = {
    ...newest,
    user_id: canonicalId,
    videos_completed_count: Math.max(...rows.map(row => row.videos_completed_count ?? 0)),
    all_completed_at: earliest(rows.map(row => row.all_completed_at)),
    event_booked: rows.some(row => row.event_booked),
    event_booked_at: earliest(rows.map(row => row.event_booked_at)),
    invest_avond_geclaimd: rows.some(row => row.invest_avond_geclaimd),
    invest_avond_verschenen: rows.some(row => row.invest_avond_verschenen),
    last_activity_at: latest(rows.map(row => row.last_activity_at)),
    updated_at: latest(rows.map(row => row.updated_at)),
  }
  const { error } = await supabase.from('demo_invest_user_funnel').insert(merged)
  if (error) throw new Error(`Funnel samenvoegen mislukt: ${error.message}`)
}

async function mergeScan(allIds, canonicalId) {
  const rows = await rowsForUsers('demo_invest_vermogensscan', 'user_id', allIds)
  if (!rows.length) return
  const keep = [...rows].sort((a, b) => (Date.parse(b.saved_at) || 0) - (Date.parse(a.saved_at) || 0))[0]
  await deleteByIds('demo_invest_vermogensscan', rows.map(row => row.id))
  const { error } = await supabase.from('demo_invest_vermogensscan').insert({ ...keep, user_id: canonicalId })
  if (error) throw new Error(`Vermogensscan samenvoegen mislukt: ${error.message}`)
}

async function mergeConflictTable(table, column, key, allIds, canonicalId, dateColumn) {
  const rows = await rowsForUsers(table, column, allIds)
  const winners = new Map()
  for (const row of rows) {
    const current = winners.get(row[key])
    if (!current || (Date.parse(row[dateColumn] ?? '') || 0) > (Date.parse(current[dateColumn] ?? '') || 0)) winners.set(row[key], row)
  }
  await deleteByIds(table, rows.map(row => row.id).filter(Boolean))
  for (const row of winners.values()) {
    const merged = { ...row, [column]: canonicalId }
    const { error } = await supabase.from(table).insert(merged)
    if (error) throw new Error(`${table} samenvoegen mislukt: ${error.message}`)
  }
}

async function mergeTriggerDeliveries(allIds, canonicalId) {
  const table = 'demo_invest_trigger_delivery'
  const rows = await rowsForUsers(table, 'user_id', allIds)
  const winners = new Map()
  for (const row of rows) {
    const current = winners.get(row.workflow_naam)
    if (!current || (Date.parse(row.updated_at) || 0) > (Date.parse(current.updated_at) || 0)) winners.set(row.workflow_naam, row)
  }
  const { error: deleteError } = await supabase.from(table).delete().in('user_id', allIds)
  if (deleteError) throw new Error(`${table} verwijderen mislukt: ${deleteError.message}`)
  for (const row of winners.values()) {
    const { error } = await supabase.from(table).insert({ ...row, user_id: canonicalId })
    if (error) throw new Error(`${table} samenvoegen mislukt: ${error.message}`)
  }
}

async function mergeGroup(users) {
  const canonical = canonicalUser(users)
  const sources = users.filter(user => user.id !== canonical.id)
  const allIds = users.map(user => user.id)
  const sourceIds = sources.map(user => user.id)

  await mergeProgress(allIds, sourceIds, canonical.id)
  await mergeFunnel(allIds, canonical.id)
  await mergeScan(allIds, canonical.id)
  await mergeConflictTable('demo_invest_scheduled_messages', 'lead_id', 'workflow', allIds, canonical.id, 'created_at')
  await mergeTriggerDeliveries(allIds, canonical.id)

  for (const [table, column, idColumn] of [
    ['demo_invest_sessions', 'user_id', 'token_hash'],
    ['demo_invest_invites', 'user_id', 'id'],
    ['demo_invest_trigger_sent', 'user_id', 'id'],
    ['demo_invest_quiz_submissions', 'user_id', 'id'],
    ['demo_invest_webhook_log', 'user_id', 'id'],
    ['demo_invest_event_bookings', 'user_id', 'id'],
  ]) await moveRows(table, column, sourceIds, canonical.id, idColumn)

  const { error: triggerLogError } = await supabase
    .from('demo_invest_trigger_log')
    .update({ user_id: canonical.id })
    .in('user_id', sourceIds)
  if (triggerLogError) throw new Error(`Triggerlogs overzetten mislukt: ${triggerLogError.message}`)

  const canonicalUpdate = {
    email: canonical.email.trim().toLowerCase(),
    name: canonical.name || sources.find(user => user.name)?.name || canonical.email.split('@')[0],
    role: strongestRole(users),
    locale: canonical.locale || sources.find(user => user.locale)?.locale || 'nl',
    whatsapp_opt_in: users.some(user => user.whatsapp_opt_in),
    created_at: earliest(users.map(user => user.created_at)),
    activated_at: earliest(users.map(user => user.activated_at)),
    trial_started_at: earliest(users.map(user => user.trial_started_at)),
    trial_expires_at: latest(users.map(user => user.trial_expires_at)),
    last_activity_at: latest(users.map(user => user.last_activity_at)),
    password_hash: canonical.password_hash || sources.find(user => user.password_hash)?.password_hash || null,
    hubspot_owner_id: canonical.hubspot_owner_id || sources.find(user => user.hubspot_owner_id)?.hubspot_owner_id || null,
  }
  const { error: updateError } = await supabase.from('demo_invest_users').update(canonicalUpdate).eq('id', canonical.id)
  if (updateError) throw new Error(`Canonieke gebruiker bijwerken mislukt: ${updateError.message}`)

  for (const sourceId of sourceIds) {
    const { error: archiveError } = await supabase
      .from('demo_invest_users')
      .update({
        email: `merged-${sourceId}@invalid.archer.local`,
        name: 'Samengevoegd account',
        role: 'user',
        activated_at: null,
        trial_started_at: null,
        trial_expires_at: null,
        last_activity_at: null,
        password_hash: null,
        hubspot_owner_id: null,
      })
      .eq('id', sourceId)
    if (archiveError) throw new Error(`Dubbele gebruiker archiveren mislukt: ${archiveError.message}`)
  }
}

const users = await allRows('demo_invest_users')
const groups = new Map()
for (const user of users) {
  const email = user.email?.trim().toLowerCase()
  if (!email) continue
  if (!groups.has(email)) groups.set(email, [])
  groups.get(email).push(user)
}
const duplicates = [...groups.values()].filter(group => group.length > 1)
relevantUserIds = duplicates.flatMap(group => group.map(user => user.id))

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', users: users.length, duplicateEmails: duplicates.length, duplicateRecords: duplicates.reduce((sum, group) => sum + group.length, 0) }))
if (!apply) process.exit(duplicates.length ? 2 : 0)

const repairedArchivedTriggerLogRows = await repairArchivedTriggerLogs(users)
console.log(JSON.stringify({ repairedArchivedTriggerLogRows }))

const concurrency = 4
for (let index = 0; index < duplicates.length; index += concurrency) {
  const batch = duplicates.slice(index, index + concurrency)
  await Promise.all(batch.map(group => mergeGroup(group)))
  console.log(JSON.stringify({ processedGroups: Math.min(index + batch.length, duplicates.length), totalGroups: duplicates.length }))
}

const after = await allRows('demo_invest_users', 'id,email')
const seen = new Set()
let remaining = 0
for (const user of after) {
  const email = user.email?.trim().toLowerCase()
  if (!email) continue
  if (seen.has(email)) remaining += 1
  seen.add(email)
}
console.log(JSON.stringify({ repairedGroups: duplicates.length, usersAfter: after.length, remainingDuplicateRecords: remaining }))
if (remaining) process.exit(1)
