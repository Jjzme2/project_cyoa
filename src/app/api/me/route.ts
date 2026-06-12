import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'

/**
 * Returns the caller's identity and resolved role. The client uses this to
 * gate admin-only UI; all real authorization is still enforced server-side on
 * each mutation.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    uid: auth.uid,
    email: auth.email,
    role: auth.role,
    isAdmin: auth.isAdmin,
    tier: auth.tier,
  })
}
