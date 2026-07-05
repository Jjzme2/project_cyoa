import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getUserAchievements } from '@/lib/firestore-helpers'
import { stageFor, moodFor, quipFor, daySeed, PET_SPECIES, type PetSpecies } from '@/lib/pet'
import { ACHIEVEMENT_DEFS } from '@/types'

function normalizeSpecies(value: unknown): PetSpecies {
  return PET_SPECIES.some((s) => s.id === value) ? (value as PetSpecies) : 'bird'
}

/**
 * Consolidated profile state: the avatar frame, Reader Pal, and achievements
 * panels all derive from the same `userSettings` doc + the user's achievements.
 * Serving them from one endpoint reads each source ONCE per profile load instead
 * of three separate routes re-reading them (see `profile-state-client.ts`, which
 * also dedupes the concurrent fetches the three components would otherwise make).
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const [settingsDoc, achievements] = await Promise.all([
    adminDb.collection('userSettings').doc(uid).get(),
    getUserAchievements(uid),
  ])
  const settings = settingsDoc.data()

  // Frame (mirrors GET /api/profile/frame)
  const equipped = (settings?.equippedFrame as string | undefined) ?? 'default'

  // Reader Pal (mirrors GET /api/profile/pet)
  const species = normalizeSpecies(settings?.petSpecies)
  const pet = {
    name: (settings?.petName as string | undefined) ?? 'Inkling',
    species,
    stage: stageFor(species, achievements.earned.length),
    mood: moodFor(achievements.updatedAt),
    quip: quipFor(moodFor(achievements.updatedAt), daySeed()),
    achievementsEarned: achievements.earned.length,
  }

  // Achievements (mirrors GET /api/achievements)
  const enriched = ACHIEVEMENT_DEFS.map((def) => ({
    ...def,
    earned: achievements.earned.includes(def.id),
    earnedAt: achievements.earned.includes(def.id) ? achievements.updatedAt : undefined,
  }))

  return NextResponse.json({
    frame: { equipped, earned: achievements.earned },
    pet,
    achievements: { achievements: enriched, counts: achievements.counts },
  })
}
