import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { DemoUser } from '@/lib/types'

const AUTH_MARKER_PREFIX = 'supabase:'
const AUTH_PAGE_SIZE = 1000

export function getDiscoveryAuthEmail(userId: string): string {
  return `discovery.${userId}@archerinvest.app`
}

export function createAuthMarker(authUserId: string): string {
  return `${AUTH_MARKER_PREFIX}${authUserId}`
}

export function parseAuthMarker(value: string | null | undefined): string | null {
  if (!value?.startsWith(AUTH_MARKER_PREFIX)) return null
  const authUserId = value.slice(AUTH_MARKER_PREFIX.length)
  return authUserId || null
}

export async function verifyLegacyPassword(plain: string, hash: string): Promise<boolean> {
  if (parseAuthMarker(hash)) return false
  return bcrypt.compare(plain, hash)
}

async function findDiscoveryAuthUser(userId: string) {
  const admin = createAdminClient()
  const internalEmail = getDiscoveryAuthEmail(userId)

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) throw new Error(`Supabase Auth-gebruiker opzoeken mislukt: ${error.message}`)

    const match = data.users.find(user => user.email?.toLowerCase() === internalEmail)
    if (match) return match
    if (data.users.length < AUTH_PAGE_SIZE) return null
  }
}

export async function ensureDiscoveryAuthUser(userId: string, password: string) {
  const admin = createAdminClient()
  const internalEmail = getDiscoveryAuthEmail(userId)
  const existingUser = await findDiscoveryAuthUser(userId)
  const appMetadata = {
    ...(existingUser?.app_metadata ?? {}),
    discovery_user_id: userId,
    discovery_app: true,
  }

  if (existingUser) {
    const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    })
    if (error) throw new Error(`Supabase Auth-gebruiker bijwerken mislukt: ${error.message}`)
    return { authUser: data.user, created: false }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  })
  if (error) throw new Error(`Supabase Auth-gebruiker aanmaken mislukt: ${error.message}`)
  return { authUser: data.user, created: true }
}

export async function getSessionUser(_req?: import('next/server').NextRequest): Promise<DemoUser | null> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser()

  if (error || !authUser) return null

  const userId = authUser.app_metadata?.discovery_user_id
  if (typeof userId !== 'string' || !userId) return null

  const admin = createAdminClient()
  const { data: user, error: profileError } = await admin
    .from('demo_invest_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !user) return null
  return user as DemoUser
}

export async function requireAdmin(req?: import('next/server').NextRequest): Promise<DemoUser> {
  const user = await getSessionUser(req)
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'admin') throw new Error('Forbidden')
  return user
}

export async function requireAdminOrMentor(req?: import('next/server').NextRequest): Promise<DemoUser> {
  const user = await getSessionUser(req)
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'admin' && user.role !== 'mentor') throw new Error('Forbidden')
  return user
}
