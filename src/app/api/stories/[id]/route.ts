import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth'
import { ratingRank, clampRating } from '@/lib/ratings'
import { getStory, getStoryNode, getWorld, incrementStoryViews, updateStoryRating } from '@/lib/firestore-helpers'
import { CONTENT_RATINGS } from '@/types'
import type { ContentRating } from '@/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [story] = await Promise.all([getStory(id), incrementStoryViews(id)])
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Withhold the opening chapter from viewers below the story's age rating.
  const auth = await getAuthContext(req)
  const restricted = ratingRank(story.rating) > (auth?.allowedRank ?? 0)
  const rootNode =
    !restricted && story.rootNodeId ? await getStoryNode(id, story.rootNodeId) : null

  return NextResponse.json({ story, rootNode, restricted })
}

/**
 * Update a story's content rating. The author may set their own story's rating;
 * an admin may override any story's rating (recorded as an override).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const rating = body.rating as ContentRating
  if (!CONTENT_RATINGS.includes(rating)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
  }

  const story = await getStory(id)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  const isOwner = story.authorId === auth.uid
  if (!isOwner && !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // A story can't be rated more mature than its world.
  const world = await getWorld(story.worldId).catch(() => null)
  const finalRating = world?.rating ? clampRating(rating, world.rating) : rating

  const override = auth.isAdmin && !isOwner
  await updateStoryRating(id, finalRating, auth.uid, override)

  revalidateTag('stories', 'max')
  revalidateTag(`story-${id}`, 'max')

  return NextResponse.json({
    ok: true,
    rating: finalRating,
    overridden: override,
    clamped: finalRating !== rating,
  })
}
