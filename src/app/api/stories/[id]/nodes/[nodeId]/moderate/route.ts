import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { getStoryNode, setNodeModeration } from '@/lib/firestore-helpers'

const ModerateSchema = z.object({
  action: z.enum(['approve', 'reject'], { message: 'action must be "approve" or "reject"' }),
})

/**
 * Admin-only: approve or reject a flagged/inappropriate route.
 * Rejecting hides the route from readers and reopens its parent slot.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const { id: storyId, nodeId } = await params

  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJson(req, ModerateSchema)
  if (!parsed.ok) return parsed.response
  const { action } = parsed.data

  // Include unpublished so an admin can act on a flagged node.
  const node = await getStoryNode(storyId, nodeId, true)
  if (!node) return NextResponse.json({ error: 'Route not found' }, { status: 404 })

  await setNodeModeration(storyId, nodeId, action, auth.uid)

  revalidateTag(`node-${storyId}-${nodeId}`, 'max')
  if (node.parentId) revalidateTag(`node-${storyId}-${node.parentId}`, 'max')
  revalidateTag(`story-${storyId}`, 'max')
  revalidateTag(`story-tree-${storyId}`, 'max')

  return NextResponse.json({ ok: true, action, status: action === 'approve' ? 'approved' : 'rejected' })
}
