import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getStory } from '@/lib/firestore-helpers'
import { canView } from '@/lib/ratings'
import { createRoom } from '@/lib/rooms'

/** Create a co-op reading room for a story (the creator becomes host). */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const storyId = typeof body.storyId === 'string' ? body.storyId : ''
  if (!storyId) return NextResponse.json({ error: 'storyId required' }, { status: 400 })

  const story = await getStory(storyId).catch(() => null)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  if (!canView(story.rating, auth.allowedRank)) {
    return NextResponse.json({ error: 'age_restricted', rating: story.rating ?? 'Mature' }, { status: 403 })
  }

  const result = await createRoom(storyId, { uid: auth.uid, name: auth.name })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ roomId: result.roomId })
}
