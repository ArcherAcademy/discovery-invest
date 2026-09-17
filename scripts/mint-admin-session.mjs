import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, key)

const { data: admin } = await supabase
  .from('demo_invest_users')
  .select('id, email, role')
  .eq('role', 'admin')
  .limit(1)
  .maybeSingle()

if (!admin) { console.error('no admin found'); process.exit(1) }

const raw = crypto.randomBytes(32).toString('hex')
const tokenHash = crypto.createHash('sha256').update(raw).digest('hex')
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

const { error } = await supabase
  .from('demo_invest_sessions')
  .insert({ token_hash: tokenHash, user_id: admin.id, expires_at: expiresAt })

if (error) { console.error(error.message); process.exit(1) }
console.log(JSON.stringify({ token: raw, email: admin.email }))
