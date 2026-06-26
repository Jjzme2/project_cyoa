import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, isAdminEmail } from '@/lib/auth'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

const PAGE_SIZE = 50

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

/** Admin-only: paginated list of users with their role, tier, and credit balance. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const pageToken = req.nextUrl.searchParams.get('pageToken') || undefined

  let listResult
  try {
    listResult = await adminAuth.listUsers(PAGE_SIZE, pageToken)
  } catch (err) {
    console.error('[admin/users] listUsers failed:', err)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 502 })
  }

  // Pull each user's purchased-credit balance in one batched read.
  const settingsRefs = listResult.users.map((u) => adminDb.collection('userSettings').doc(u.uid))
  const settingsSnaps = settingsRefs.length ? await adminDb.getAll(...settingsRefs) : []
  const creditsByUid = new Map<string, number>()
  settingsSnaps.forEach((snap) => {
    creditsByUid.set(snap.id, snap.exists ? (snap.data()?.purchasedCredits ?? 0) : 0)
  })

  const users: AdminUserRow[] = listResult.users.map((u) => {
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

  return NextResponse.json({ users, nextPageToken: listResult.pageToken ?? null })
}
