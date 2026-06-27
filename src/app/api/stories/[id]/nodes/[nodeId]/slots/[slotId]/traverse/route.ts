import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { incrementTraversal } from '@/lib/firestore-helpers'

const TraverseSchema = z.object({ childNodeId: z.string().min(1, 'childNodeId required') })

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
  const parsed = await parseJson(req, TraverseSchema)
  if (!parsed.ok) return parsed.response

  try {
    await incrementTraversal(storyId, nodeId, slotId, parsed.data.childNodeId)
  } catch {
    // best-effort; popularity counters should never break reading
  }
  return NextResponse.json({ ok: true })
}
