import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext, requireRegisteredAccount } from '@/lib/auth'
import {
  getReadingProgress,
  saveReadingProgress,
  checkAndAwardAchievements,
  getStory,
  storyNodeExists,
} from '@/lib/firestore-helpers'

const ProgressSchema = z.object({
  currentNodeId: z.string().min(1),
  nodeHistory: z.array(z.string()),
})

/**
 * Reading achievements (`story_read`, `first_choice`) now grant spendable
 * credits, so they can't be trusted to client-supplied progress. Award them
 * only when: the caller is a registered account (guests — free, disposable —
 * can't farm them), the story actually exists, and the reported current node
 * is a real node of it. Best-effort and never blocks the progress save.
 */
async function awardReadAchievements(
  uid: string,
  storyId: string,
  currentNodeId: string,
  nodeHistory: string[],
): Promise<void> {
  const story = await getStory(storyId)
  if (!story) return
  if (!(await storyNodeExists(storyId, currentNodeId))) return

  await checkAndAwardAchievements(uid, 'story_read', { storyId })
  // The first time any reader advances past a root chapter is their first
  // choice ever — idempotent across every story.
  if (nodeHistory.length === 1) {
    await checkAndAwardAchievements(uid, 'first_choice')
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyId } = await params
  const progress = await getReadingProgress(auth.uid, storyId)
  return NextResponse.json(progress ?? { currentNodeId: null, nodeHistory: [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyId } = await params
  const parsed = await parseJson(req, ProgressSchema)
  if (!parsed.ok) return parsed.response
  const { currentNodeId, nodeHistory } = parsed.data

  await saveReadingProgress(auth.uid, storyId, currentNodeId, nodeHistory)

  if (!requireRegisteredAccount(auth)) {
    awardReadAchievements(auth.uid, storyId, currentNodeId, nodeHistory).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
