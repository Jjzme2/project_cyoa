import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { incrementTraversal, checkAndAwardAchievements } from '@/lib/firestore-helpers'

const TraverseSchema = z.object({ childNodeId: z.string().min(1, 'childNodeId required') })

/** A written path this popular earns its author the "Path Pioneer" achievement. */
const PATH_PIONEER_THRESHOLD = 25

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
    const { slotTraversals, submittedBy } = await incrementTraversal(
      storyId, nodeId, slotId, parsed.data.childNodeId,
    )
    if (submittedBy && slotTraversals === PATH_PIONEER_THRESHOLD) {
      checkAndAwardAchievements(submittedBy, 'path_traversal_milestone').catch(() => {})
    }
  } catch {
    // best-effort; popularity counters should never break reading
  }
  return NextResponse.json({ ok: true })
}
