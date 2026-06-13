import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth'
import { getWorld, updateWorldRating, clampStoriesToWorldRating } from '@/lib/firestore-helpers'
import { CONTENT_RATINGS } from '@/types'
import type { ContentRating } from '@/types'

/**
 * Update a world's content rating. The creator may set their own world's
 * rating; an admin may override any world's rating (recorded as an override).
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

  const world = await getWorld(id)
  if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })

  const isOwner = world.authorId === auth.uid
  if (!isOwner && !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // An admin acting on a world they don't own is recorded as an override.
  const override = auth.isAdmin && !isOwner
  await updateWorldRating(id, rating, auth.uid, override)

  // Lowering a world's rating pulls any over-rated stories down to the ceiling.
  const clampedStories = await clampStoriesToWorldRating(id, rating)

  revalidateTag('worlds', 'max')
  revalidateTag(`world-${id}`, 'max')
  if (clampedStories > 0) revalidateTag('stories', 'max')

  return NextResponse.json({ ok: true, rating, overridden: override, clampedStories })
}
