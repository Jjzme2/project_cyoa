import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { incrementTraversal, checkAndAwardAchievements } from '@/lib/firestore-helpers'

const TraverseSchema = z.object({ childNodeId: z.string().min(1, 'childNodeId required') })

/** A written path chosen by this many DISTINCT readers earns its author "Path Pioneer". */
const PATH_PIONEER_THRESHOLD = 25

/**
 * Records that a reader took this path (powers "% went here" and path reads).
 * Auth is OPTIONAL and best-effort: anonymous reads still count toward the public
 * popularity counter, but only a signed-in, registered reader who is NOT the
 * path's author counts toward the credit-bearing Path Pioneer milestone — and
 * only once per (reader, slot). That stops an author from minting the reward by
 * scripting traversals of their own slot. Failures are swallowed so a counter
 * hiccup never disrupts navigation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string; slotId: string }> },
) {
  const { id: storyId, nodeId, slotId } = await params
  const parsed = await parseJson(req, TraverseSchema)
  if (!parsed.ok) return parsed.response

  // A guest (anonymous Firebase account) reads freely but can't move the reward
  // counter — same bar as every other credit-bearing event.
  const auth = await getAuthContext(req)
  const traverserUid = auth && !auth.isAnonymous ? auth.uid : null

  try {
    const { milestoneTraversals, submittedBy } = await incrementTraversal(
      storyId, nodeId, slotId, parsed.data.childNodeId, traverserUid,
    )
    if (submittedBy && milestoneTraversals === PATH_PIONEER_THRESHOLD) {
      checkAndAwardAchievements(submittedBy, 'path_traversal_milestone').catch(() => {})
    }
  } catch {
    // best-effort; popularity counters should never break reading
  }
  return NextResponse.json({ ok: true })
}
