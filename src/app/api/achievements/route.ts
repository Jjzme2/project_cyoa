import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getUserAchievements } from '@/lib/firestore-helpers'
import { ACHIEVEMENT_DEFS } from '@/types'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const userAchievements = await getUserAchievements(uid)
  const enriched = ACHIEVEMENT_DEFS.map((def) => ({
    ...def,
    earned: userAchievements.earned.includes(def.id),
    earnedAt: userAchievements.earned.includes(def.id) ? userAchievements.updatedAt : undefined,
  }))

  return NextResponse.json({ achievements: enriched, counts: userAchievements.counts })
}
