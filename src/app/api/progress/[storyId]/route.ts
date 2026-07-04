import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { getReadingProgress, saveReadingProgress, checkAndAwardAchievements } from '@/lib/firestore-helpers'

const ProgressSchema = z.object({
  currentNodeId: z.string().min(1),
  nodeHistory: z.array(z.string()),
})

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyId } = await params
  const progress = await getReadingProgress(uid, storyId)
  return NextResponse.json(progress ?? { currentNodeId: null, nodeHistory: [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyId } = await params
  const parsed = await parseJson(req, ProgressSchema)
  if (!parsed.ok) return parsed.response
  const { currentNodeId, nodeHistory } = parsed.data

  await saveReadingProgress(uid, storyId, currentNodeId, nodeHistory)
  checkAndAwardAchievements(uid, 'story_read', { storyId }).catch(() => {})
  // The very first time ANY reader's history goes from the root to a second
  // chapter is their first choice ever — idempotent across every story, so
  // this only ever actually earns once no matter how many stories arrive here.
  if (nodeHistory.length === 1) {
    checkAndAwardAchievements(uid, 'first_choice').catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
