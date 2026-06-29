import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { getStoryNode, checkAndAwardAchievements } from '@/lib/firestore-helpers'

const Schema = z.object({ storyId: z.string().min(1), nodeId: z.string().min(1) })

/**
 * Award narrative ending achievements when a reader reaches a definitive ending.
 * The node is re-read server-side (the client can't claim an ending that isn't
 * one), and its type drives the "secret"/"all kinds" achievements. Returns any
 * newly-earned achievement ids so the reader can be congratulated + offered a
 * share card.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, Schema)
  if (!parsed.ok) return parsed.response
  const { storyId, nodeId } = parsed.data

  const node = await getStoryNode(storyId, nodeId).catch(() => null)
  if (!node || node.storyId !== storyId || !node.isEnding) {
    return NextResponse.json({ newlyEarned: [] })
  }

  const newlyEarned = await checkAndAwardAchievements(auth.uid, 'ending_reached', { endingType: node.endingType })
  return NextResponse.json({ newlyEarned })
})
