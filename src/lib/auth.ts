import { adminAuth } from './firebase-admin'
import { ageFromDob, allowedRankForAge, RATING_RANK } from './ratings'
import type { Role } from '@/types'

/**
 * Server-side authentication + role resolution.
 *
 * Roles are stored as Firebase custom claims (`role: 'admin'`), matching the
 * existing `tier` claim pattern. As a zero-setup bootstrap, any email listed in
 * the `ADMIN_EMAILS` env var is also treated as an admin even without the claim
 * (use `scripts/set-admin.ts` to persist the claim so it propagates to the
 * client token).
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export interface AuthContext {
  uid: string
  email: string | null
  name: string | null
  tier: 'FREE' | 'PREMIUM'
  role: Role
  isAdmin: boolean
  /** Self-reported date of birth (ISO), surfaced from a custom claim. */
  dob: string | null
  age: number | null
  /** Highest content rank this viewer may see (see lib/ratings). */
  allowedRank: number
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

function bearerToken(req: Request): string | null {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? null
}

/**
 * Resolve the caller from a Bearer ID token. Returns `null` when the request is
 * unauthenticated or the token is invalid — callers decide whether that's a 401
 * (mutations) or simply an anonymous view (public reads).
 */
export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const token = bearerToken(req)
  if (!token) return null

  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const email = decoded.email ?? null
    const claimRole = decoded.role as Role | undefined
    const isAdmin = claimRole === 'admin' || isAdminEmail(email)
    const dob = (decoded.dob as string | undefined) ?? null
    const age = ageFromDob(dob)

    return {
      uid: decoded.uid,
      email,
      name: decoded.name ?? null,
      tier: (decoded.tier as 'FREE' | 'PREMIUM') ?? 'FREE',
      role: isAdmin ? 'admin' : 'user',
      isAdmin,
      dob,
      age,
      // Admins bypass the age gate for moderation purposes.
      allowedRank: isAdmin ? RATING_RANK.Mature : allowedRankForAge(age),
    }
  } catch {
    return null
  }
}
