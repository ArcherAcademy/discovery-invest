/**
 * lib/access.ts
 *
 * Eén bron van waarheid voor "mag deze gebruiker binnen?".
 *
 * Regels:
 *  - Admins en mentors hebben altijd toegang. Dat wordt live afgeleid uit de
 *    rol, niet uit een trial-datum ver in de toekomst. Zet dus nooit een
 *    kunstmatige trial_expires_at voor deze rollen.
 *  - Voor gewone gebruikers geldt trial_expires_at. Is die verstreken, dan is
 *    de trial verlopen — maar het account en alle data blijven bestaan en
 *    zichtbaar voor admin en mentor.
 */

import type { DemoUser, UserRole } from '@/lib/types'

/** Rollen die nooit verlopen. */
export function hasPermanentAccess(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'mentor'
}

/** True als de trial van deze gebruiker verstreken is. Nooit waar voor admin/mentor. */
export function isTrialExpired(
  user: Pick<DemoUser, 'role' | 'activated_at' | 'trial_expires_at'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!user) return false
  if (hasPermanentAccess(user.role)) return false
  if (!user.activated_at) return false
  if (!user.trial_expires_at) return false
  return new Date(user.trial_expires_at).getTime() <= now.getTime()
}

/**
 * Resterende trialdagen. Geeft `null` voor admin/mentor (= onbeperkt) en voor
 * accounts zonder trialdatum, zodat de UI daar "onbeperkte toegang" kan tonen
 * in plaats van een dagen-teller.
 */
export function trialDaysRemaining(
  user: Pick<DemoUser, 'role' | 'trial_expires_at'> | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!user || hasPermanentAccess(user.role) || !user.trial_expires_at) return null
  const msLeft = new Date(user.trial_expires_at).getTime() - now.getTime()
  return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))
}

/** Mag deze gebruiker de app in? Admin/mentor altijd; gewone gebruikers zolang de trial loopt. */
export function hasAppAccess(
  user: Pick<DemoUser, 'role' | 'activated_at' | 'trial_expires_at'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!user) return false
  if (hasPermanentAccess(user.role)) return true
  return !isTrialExpired(user, now)
}
