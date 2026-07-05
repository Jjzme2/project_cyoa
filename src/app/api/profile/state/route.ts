import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getUserAchievements } from '@/lib/firestore-helpers'
import {
  bondXp,
  xpProgress,
  stageFor,
  moodFor,
  quipFor,
  daySeed,
  palStats,
  unlockedSpecies,
  isSpeciesUnlocked,
  PET_SPECIES,
  type PetSpecies,
} from '@/lib/pet'
import { ACHIEVEMENT_DEFS } from '@/types'

function normalizeSpecies(value: unknown, earned: string[]): PetSpecies {
  const valid = PET_SPECIES.some((s) => s.id === value) ? (value as PetSpecies) : 'bird'
  // A species whose gate the reader no longer satisfies (or never did — e.g. a
  // hand-edited doc) falls back to the default rather than leaking the skin.
  return isSpeciesUnlocked(valid, earned) ? valid : 'bird'
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

  // Reader Pal — bond XP/level derived entirely from already-tracked counts.
  const species = normalizeSpecies(settings?.petSpecies, achievements.earned)
  const xp = xpProgress(bondXp(achievements.earned.length, achievements.counts))
  const mood = moodFor(achievements.updatedAt)
  const pet = {
    name: (settings?.petName as string | undefined) ?? 'Inkling',
    species,
    stage: stageFor(species, xp.level),
    level: xp.level,
    xp,
    mood,
    quip: quipFor(mood, daySeed()),
    achievementsEarned: achievements.earned.length,
    unlockedSpecies: unlockedSpecies(achievements.earned),
    stats: palStats(achievements.counts),
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
