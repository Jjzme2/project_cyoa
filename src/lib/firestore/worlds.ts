import { adminDb } from '../firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'
import type { World, ContentRating, WorldMultiverse, WorldLink } from '@/types'
import { ratingRank } from '../ratings'
import { storyRef } from './refs'
import { getStoriesByWorld } from './stories'

// ─── Worlds ──────────────────────────────────────────────────────────────────

/** Store a world's generated canon (the "world bible"). */
export async function setWorldGenesis(worldId: string, genesis: import('@/types').WorldBible): Promise<void> {
  await adminDb.collection('worlds').doc(worldId).set({ genesis }, { merge: true })
}

/**
 * Update a world's multiverse membership and explicit links. Lets EXISTING worlds
 * opt into (or out of) the multiverse system, not just newly-created ones — pass
 * null to clear either. Stories inherit automatically: generation reads the live
 * world doc, so this takes effect on the next chapter.
 */
export async function setWorldMultiverse(
  worldId: string,
  patch: { multiverse: WorldMultiverse | null; links: WorldLink[] | null },
): Promise<void> {
  await adminDb
    .collection('worlds')
    .doc(worldId)
    .set({ multiverse: patch.multiverse, links: patch.links }, { merge: true })
}

/** Set (or clear) a world's hand-picked guest-star Character ids (capped at 5). */
export async function setWorldGuestStars(worldId: string, characterIds: string[]): Promise<void> {
  await adminDb
    .collection('worlds')
    .doc(worldId)
    .set({ guestStarCharacterIds: characterIds.slice(0, 5) }, { merge: true })
}

export async function getWorld(id: string): Promise<World | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(`world-${id}`, 'worlds')

  const doc = await adminDb.collection('worlds').doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as World
}

/** Every world tagged into a given multiverse pool (members share legends). */
export async function getWorldsByMultiverse(multiverseId: string, limit = 12): Promise<World[]> {
  const snap = await adminDb
    .collection('worlds')
    .where('multiverse.id', '==', multiverseId)
    .limit(limit)
    .get()
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as World))
}

export async function getWorldsByAuthor(authorId: string): Promise<World[]> {
  const snap = await adminDb
    .collection('worlds')
    .where('authorId', '==', authorId)
    .get()

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as World))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
}

export async function createWorld(
  data: Omit<World, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = adminDb.collection('worlds').doc()
  await ref.set({ ...data, createdAt: new Date().toISOString() })
  return ref.id
}

export async function updateWorldRating(
  worldId: string,
  rating: ContentRating,
  byUid: string,
  override: boolean,
): Promise<void> {
  await adminDb.collection('worlds').doc(worldId).update({
    rating,
    // Track admin overrides so a creator can't silently undo a moderator's call.
    ratingOverriddenBy: override ? byUid : null,
  })
}

/**
 * Clamp every story in a world down to the world's rating (used when a world's
 * rating is lowered). Returns how many stories were adjusted.
 */
export async function clampStoriesToWorldRating(
  worldId: string,
  worldRating: ContentRating,
): Promise<number> {
  const stories = await getStoriesByWorld(worldId)
  const ceiling = ratingRank(worldRating)
  const over = stories.filter((s) => ratingRank(s.rating) > ceiling)
  if (over.length === 0) return 0

  const batch = adminDb.batch()
  for (const s of over) batch.update(storyRef(s.id), { rating: worldRating })
  await batch.commit()
  return over.length
}

// ─── Story Nodes ──────────────────────────────────────────────────────────────

// ─── Public Worlds ────────────────────────────────────────────────────────────

export async function getPublicWorlds(limit = 100): Promise<World[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('worlds')

  const snap = await adminDb.collection('worlds').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as World))
}

