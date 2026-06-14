import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getStory } from '@/lib/firestore-helpers'
import { canView } from '@/lib/ratings'
import { joinRoom, getRoomStoryId } from '@/lib/rooms'

/** Join a room — enforces the story's age/rating gate. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storyId = await getRoomStoryId(roomId)
  if (!storyId) return NextResponse.json({ error: 'Room not found' }, { status: 404 })

  const story = await getStory(storyId).catch(() => null)
  if (story && !canView(story.rating, auth.allowedRank)) {
    return NextResponse.json({ error: 'age_restricted', rating: story.rating ?? 'Mature' }, { status: 403 })
  }

  const result = await joinRoom(roomId, { uid: auth.uid, name: auth.name })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
