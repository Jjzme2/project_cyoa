import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { ratingRank, clampRating } from '@/lib/ratings'
import { getStory, getStoryNode, getWorld, incrementStoryViews, updateStoryRating } from '@/lib/firestore-helpers'
import { CONTENT_RATINGS } from '@/types'

const RatingSchema = z.object({
  rating: z.enum(CONTENT_RATINGS, { message: 'Invalid rating' }),
})

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

  const parsed = await parseJson(req, RatingSchema)
  if (!parsed.ok) return parsed.response
  const { rating } = parsed.data

  const story = await getStory(id)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  const isOwner = story.authorId === auth.uid
  if (!isOwner && !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Once a story is underway — it has grown past its opening chapter — its
  // author can no longer change the rating, since doing so would retroactively
  // re-label content others have already written under it. Admins may still
  // override (the moderation escape hatch).
  if (isOwner && !auth.isAdmin && (story.nodeCount ?? 0) > 1) {
    return NextResponse.json(
      { error: 'The rating is locked once a story is underway. Contact an admin if it needs changing.' },
      { status: 409 },
    )
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
