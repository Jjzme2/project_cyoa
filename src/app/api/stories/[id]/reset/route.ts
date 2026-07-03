import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { getStory, resetStoryTree } from '@/lib/firestore-helpers'
import { insights } from '@/lib/telemetry'

/**
 * Reset a story's sequence back to its opening so it can be retried in place —
 * without recreating the story or world (e.g. after a world turned gentle).
 * Destructive to written chapters, so it's restricted to the story's author or
 * an admin; open bounties on destroyed paths are refunded inside the reset.
 */
export const POST = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id: storyId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const story = await getStory(storyId)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  if (story.authorId !== auth.uid && !auth.isAdmin) {
    return NextResponse.json({ error: 'Only the author (or an admin) can reset a story.' }, { status: 403 })
  }

  const { kept, deleted, frontierIds } = await resetStoryTree(storyId)

  revalidateTag(`story-${storyId}`, 'max')
  revalidateTag(`story-tree-${storyId}`, 'max')
  revalidateTag('stories', 'max')
  // The kept frontier's slots changed — bust their per-node caches so readers
  // see reopened choices immediately, not after the cache window.
  for (const nodeId of frontierIds) revalidateTag(`node-${storyId}-${nodeId}`, 'max')

  await insights.track('story.reset', {
    uid: auth.uid,
    props: { storyId, kept, deleted, byAdmin: auth.isAdmin && story.authorId !== auth.uid },
  })

  return NextResponse.json({ ok: true, kept, deleted })
})
