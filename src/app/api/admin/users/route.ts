import { NextRequest, NextResponse } from 'next/server'
import type { UserRecord } from 'firebase-admin/auth'
import { getAuthContext, isAdminEmail } from '@/lib/auth'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { userMatchesQuery } from '@/lib/admin-user-search'

const PAGE_SIZE = 50
// Bounds for substring search: Firebase Auth can't query by substring, so we
// scan pages and filter. Capped so a large user base can't blow up the request.
const SCAN_BATCH = 1000 // max listUsers page size
const SCAN_LIMIT = 5000 // max users scanned per search
const RESULT_CAP = 100 // max matches returned

export interface AdminUserRow {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  role: 'user' | 'admin'
  tier: 'FREE' | 'PREMIUM'
  disabled: boolean
  createdAt: string | null
  lastSignIn: string | null
  purchasedCredits: number
}

/** Hydrate Auth records into rows, batching the purchased-credit reads. */
async function buildRows(records: UserRecord[]): Promise<AdminUserRow[]> {
  if (records.length === 0) return []
  const refs = records.map((u) => adminDb.collection('userSettings').doc(u.uid))
  const snaps = await adminDb.getAll(...refs)
  const creditsByUid = new Map<string, number>()
  snaps.forEach((snap) => {
    creditsByUid.set(snap.id, snap.exists ? (snap.data()?.purchasedCredits ?? 0) : 0)
  })

  return records.map((u) => {
    const claims = u.customClaims ?? {}
    const isAdmin = claims.role === 'admin' || isAdminEmail(u.email)
    return {
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      photoURL: u.photoURL ?? null,
      role: isAdmin ? 'admin' : 'user',
      tier: (claims.tier as 'FREE' | 'PREMIUM') ?? 'FREE',
      disabled: u.disabled,
      createdAt: u.metadata.creationTime ?? null,
      lastSignIn: u.metadata.lastSignInTime ?? null,
      purchasedCredits: creditsByUid.get(u.uid) ?? 0,
    }
  })
}

/** Find users matching `q` by exact email/uid, then a bounded substring scan. */
async function searchUsers(q: string): Promise<NextResponse> {
  const matches = new Map<string, UserRecord>()

  // Exact lookups are O(1) and guaranteed even beyond the scan cap.
  if (q.includes('@')) {
    try {
      const u = await adminAuth.getUserByEmail(q)
      matches.set(u.uid, u)
    } catch {
      /* not found — fall through to scan */
    }
  }
  try {
    const u = await adminAuth.getUser(q)
    matches.set(u.uid, u)
  } catch {
    /* not a uid — fall through to scan */
  }

  // Bounded substring scan across the user base.
  let scanned = 0
  let capped = false
  let pageToken: string | undefined
  try {
    while (scanned < SCAN_LIMIT) {
      const batch = await adminAuth.listUsers(SCAN_BATCH, pageToken)
      for (const u of batch.users) {
        scanned++
        if (userMatchesQuery(u, q)) {
          matches.set(u.uid, u)
          if (matches.size >= RESULT_CAP) {
            capped = true
            break
          }
        }
      }
      if (capped || !batch.pageToken) break
      pageToken = batch.pageToken
      if (scanned >= SCAN_LIMIT) {
        capped = true
        break
      }
    }
  } catch (err) {
    console.error('[admin/users] search scan failed:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 502 })
  }

  const users = await buildRows([...matches.values()])
  users.sort((a, b) => (a.email ?? a.uid).localeCompare(b.email ?? b.uid))
  return NextResponse.json({ users, nextPageToken: null, query: q, scanned, capped })
}

/** Admin-only: paginated user list, or a filtered search when `?q=` is present. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (q) return searchUsers(q)

  const pageToken = req.nextUrl.searchParams.get('pageToken') || undefined
  let listResult
  try {
    listResult = await adminAuth.listUsers(PAGE_SIZE, pageToken)
  } catch (err) {
    console.error('[admin/users] listUsers failed:', err)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 502 })
  }

  const users = await buildRows(listResult.users)
  return NextResponse.json({ users, nextPageToken: listResult.pageToken ?? null })
}
