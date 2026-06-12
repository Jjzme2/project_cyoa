import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getModerationQueue } from '@/lib/firestore-helpers'

/** Admin-only: the queue of flagged routes awaiting review. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100)
  const queue = await getModerationQueue(limit)
  return NextResponse.json({ queue })
}
