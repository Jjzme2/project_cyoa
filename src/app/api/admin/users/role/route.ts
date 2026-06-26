import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { adminAuth } from '@/lib/firebase-admin'
import { insights } from '@/lib/telemetry'

/**
 * Admin-only: set a user's `role` (user/admin) and/or `tier` (FREE/PREMIUM).
 * Updates Firebase custom claims, preserving any other claims already set. The
 * affected user picks up the change on their next token refresh.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { uid?: string; role?: string; tier?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const uid = typeof body.uid === 'string' ? body.uid.trim() : ''
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })

  const role = body.role
  const tier = body.tier
  if (role !== undefined && role !== 'user' && role !== 'admin') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (tier !== undefined && tier !== 'FREE' && tier !== 'PREMIUM') {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (role === undefined && tier === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Guard against an admin accidentally stripping their own access.
  if (uid === auth.uid && role === 'user') {
    return NextResponse.json({ error: 'You cannot remove your own admin role.' }, { status: 400 })
  }

  let existing: Record<string, unknown>
  try {
    const target = await adminAuth.getUser(uid)
    existing = { ...(target.customClaims ?? {}) }
  } catch {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (role !== undefined) {
    if (role === 'admin') existing.role = 'admin'
    else delete existing.role
  }
  if (tier !== undefined) existing.tier = tier

  await adminAuth.setCustomUserClaims(uid, existing)
  await insights.track('admin.role_changed', {
    uid: auth.uid,
    props: { targetUid: uid, role, tier, byEmail: auth.email },
  })

  return NextResponse.json({ ok: true, role: existing.role === 'admin' ? 'admin' : 'user', tier: existing.tier ?? 'FREE' })
}
