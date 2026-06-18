import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth'
import { flagSlotVote, getChoiceSlot } from '@/lib/firestore-helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string; slotId: string }> },
) {
  const { id: storyId, nodeId, slotId } = await params

  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slot = await getChoiceSlot(storyId, nodeId, slotId)
  if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  if (!slot.filled || !slot.childNodeId) {
    return NextResponse.json({ error: 'Can only flag filled paths' }, { status: 400 })
  }
  if (slot.pendingReview) {
    return NextResponse.json({ error: 'Path is already under review' }, { status: 400 })
  }
  // Submitters cannot flag their own path
  if (slot.submittedBy === auth.uid) {
    return NextResponse.json({ error: 'You cannot flag your own path' }, { status: 400 })
  }

  try {
    const result = await flagSlotVote(storyId, nodeId, slotId, auth.uid)

    if (result.autoRemoved) {
      revalidateTag(`node-${storyId}-${nodeId}`, 'max')
      if (slot.childNodeId) revalidateTag(`node-${storyId}-${slot.childNodeId}`, 'max')
      revalidateTag(`story-${storyId}`, 'max')
      revalidateTag(`story-tree-${storyId}`, 'max')
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to register vote' },
      { status: 500 },
    )
  }
}
