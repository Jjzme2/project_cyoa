import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { adminAuth } from '@/lib/firebase-admin'
import { insights } from '@/lib/telemetry'

const RoleSchema = z
  .object({
    uid: z.string().trim().min(1, 'Missing uid'),
    role: z.enum(['user', 'admin'], { message: 'Invalid role' }).optional(),
    tier: z.enum(['FREE', 'PREMIUM'], { message: 'Invalid tier' }).optional(),
  })
  .refine((d) => d.role !== undefined || d.tier !== undefined, { message: 'Nothing to update' })

/**
 * Admin-only: set a user's `role` (user/admin) and/or `tier` (FREE/PREMIUM).
 * Updates Firebase custom claims, preserving any other claims already set. The
 * affected user picks up the change on their next token refresh.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJson(req, RoleSchema)
  if (!parsed.ok) return parsed.response
  const { uid, role, tier } = parsed.data

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
