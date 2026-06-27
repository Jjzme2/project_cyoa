import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { getStory } from '@/lib/firestore-helpers'
import { canView } from '@/lib/ratings'
import { createRoom } from '@/lib/rooms'

const CreateRoomSchema = z.object({ storyId: z.string().min(1, 'storyId required') })

/** Create a co-op reading room for a story (the creator becomes host). */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, CreateRoomSchema)
  if (!parsed.ok) return parsed.response
  const { storyId } = parsed.data

  const story = await getStory(storyId).catch(() => null)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  if (!canView(story.rating, auth.allowedRank)) {
    return NextResponse.json({ error: 'age_restricted', rating: story.rating ?? 'Mature' }, { status: 403 })
  }

  const result = await createRoom(storyId, { uid: auth.uid, name: auth.name })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ roomId: result.roomId })
}
