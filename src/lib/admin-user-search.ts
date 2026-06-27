/**
 * Pure helpers for admin user search, decoupled from firebase-admin types so
 * they can be unit-tested without initializing the Admin SDK.
 *
 * Firebase Auth has no native substring query, so the route does exact
 * email/uid lookups plus a bounded scan filtered by `userMatchesQuery`.
 */

export interface SearchableUser {
  uid: string
  email?: string | null
  displayName?: string | null
}

/**
 * Case-insensitive substring match across uid, email, and display name. An
 * empty/whitespace query matches everything (callers decide whether to search).
 */
export function userMatchesQuery(user: SearchableUser, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    user.uid.toLowerCase().includes(q) ||
    (user.email ?? '').toLowerCase().includes(q) ||
    (user.displayName ?? '').toLowerCase().includes(q)
  )
}
