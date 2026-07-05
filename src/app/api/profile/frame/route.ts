import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getUserAchievements } from '@/lib/firestore-helpers'
import { FRAME_SKINS, isFrameUnlocked } from '@/lib/cosmetics'

async function resolveUser(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    return (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return null
  }
}

// The reader's equipped frame + unlocked frames are served by the consolidated
// GET /api/profile/state; this route keeps only the equip mutation.

const FrameSchema = z.object({ frameId: z.string().min(1) })

/** Equip a cosmetic avatar frame — only one the reader has actually earned. */
export async function POST(req: NextRequest) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, FrameSchema)
  if (!parsed.ok) return parsed.response
  const { frameId } = parsed.data

  const frame = FRAME_SKINS.find((f) => f.id === frameId)
  if (!frame) return NextResponse.json({ error: 'Unknown frame' }, { status: 400 })

  const achievements = await getUserAchievements(uid)
  if (!isFrameUnlocked(frame, achievements.earned)) {
    return NextResponse.json({ error: 'That frame hasn’t been unlocked yet.' }, { status: 403 })
  }

  await adminDb.collection('userSettings').doc(uid).set({ equippedFrame: frameId }, { merge: true })
  return NextResponse.json({ ok: true })
}
