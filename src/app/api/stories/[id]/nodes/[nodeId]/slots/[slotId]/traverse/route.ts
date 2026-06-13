import { NextRequest, NextResponse } from 'next/server'
import { incrementTraversal } from '@/lib/firestore-helpers'

/**
 * Records that a reader took this path (powers "% went here" and path reads).
 * Unauthenticated and best-effort — anonymous reads count, and failures are
 * swallowed so they never disrupt navigation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string; slotId: string }> },
) {
  const { id: storyId, nodeId, slotId } = await params
  const body = await req.json().catch(() => ({}))
  const childNodeId = body.childNodeId
  if (!childNodeId || typeof childNodeId !== 'string') {
    return NextResponse.json({ error: 'childNodeId required' }, { status: 400 })
  }

  try {
    await incrementTraversal(storyId, nodeId, slotId, childNodeId)
  } catch {
    // best-effort; popularity counters should never break reading
  }
  return NextResponse.json({ ok: true })
}
