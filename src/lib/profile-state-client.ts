import type { PetSpecies, PetStage, PetMood, XpProgress, PalStats } from '@/lib/pet'

/**
 * Client-side fetch for the consolidated `/api/profile/state` endpoint, with
 * in-flight + resolved dedup so the three self-contained profile panels
 * (avatar frame, Reader Pal, achievements) share ONE request/response per
 * profile visit instead of each hitting its own route. Mutations call
 * `invalidateProfileState()` so the next read reflects the change.
 */

export interface ProfileFrameState {
  equipped: string
  earned: string[]
}

export interface ProfilePetState {
  name: string
  species: PetSpecies
  stage: PetStage
  level: number
  xp: XpProgress
  mood: PetMood
  quip: string
  achievementsEarned: number
  /** Species the reader's achievements QUALIFY them for (gate, not ownership). */
  unlockedSpecies: PetSpecies[]
  /** Pals the reader actually owns — switching between these is free. */
  ownedSpecies: PetSpecies[]
  /** Purchased-credit price to adopt a species they don't own yet. */
  adoptionCost: number
  stats: PalStats
}

export interface EnrichedAchievement {
  id: string
  name: string
  description: string
  icon: string
  reward?: number
  earned: boolean
  earnedAt?: string
}

export interface ProfileAchievementsState {
  achievements: EnrichedAchievement[]
  counts: Record<string, number>
}

export interface ProfileState {
  frame: ProfileFrameState
  pet: ProfilePetState
  achievements: ProfileAchievementsState
}

let cached: { uid: string; promise: Promise<ProfileState> } | null = null

/**
 * Fetch the caller's profile state. Concurrent calls (and repeat mounts) for the
 * same uid share one request until it's invalidated. Pass a token getter so each
 * caller need not thread the Firebase token.
 */
export function fetchProfileState(uid: string, getToken: () => Promise<string>): Promise<ProfileState> {
  if (cached && cached.uid === uid) return cached.promise

  const promise = (async () => {
    const token = await getToken()
    const res = await fetch('/api/profile/state', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error('Failed to load profile state')
    return (await res.json()) as ProfileState
  })()

  // Drop the cache entry if the request fails, so a later mount can retry.
  promise.catch(() => {
    if (cached?.promise === promise) cached = null
  })

  cached = { uid, promise }
  return promise
}

/** Invalidate the shared cache (after a mutation, or on sign-out). */
export function invalidateProfileState(): void {
  cached = null
}
