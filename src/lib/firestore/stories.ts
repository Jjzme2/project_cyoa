import { adminDb } from '../firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { cacheLife, cacheTag } from 'next/cache'
import type { Story, StoryCharacter, ContentRating } from '@/types'
import { storyRef, nodesRef, nodeRef, slotRef } from './refs'

// ─── Stories ─────────────────────────────────────────────────────────────────

export async function getStories(limit = 20): Promise<Story[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories')

  try {
    const snap = await adminDb
      .collection('stories')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Story))
      .filter((s) => s.published !== false && !s.unlisted)
  } catch (err) {
    console.error('[getStories] orderBy failed, falling back to scan:', (err as Error).message)
    const fallback = await adminDb.collection('stories').limit(limit).get()
    return fallback.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Story))
      .filter((s) => s.published !== false && !s.unlisted)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }
}

/** Recent shared "You" mode stories — the Personal Saga browse feed. */
export async function getYouModeStories(limit = 60): Promise<Story[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories')

  // Scan recent stories and filter in memory to avoid a composite index.
  const snap = await adminDb.collection('stories').orderBy('createdAt', 'desc').limit(300).get()
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Story))
    .filter((s) => s.youMode === true && s.published !== false && !s.unlisted)
    .slice(0, limit)
}

export async function getStory(id: string): Promise<Story | null> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`story-${id}`, 'stories')

  const doc = await storyRef(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Story
}

export async function createStory(
  data: Omit<Story, 'id' | 'createdAt' | 'views' | 'nodeCount'>,
): Promise<string> {
  const ref = adminDb.collection('stories').doc()
  await ref.set({
    ...data,
    views: 0,
    nodeCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export async function incrementStoryViews(storyId: string) {
  await storyRef(storyId).update({ views: FieldValue.increment(1) })
}

export async function addStoryCharacters(
  storyId: string,
  chars: StoryCharacter[],
): Promise<void> {
  if (!chars || chars.length === 0) return
  const ref = storyRef(storyId)
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) return
    const existing: StoryCharacter[] = doc.data()?.characters ?? []
    const known = new Set(existing.map((c) => c.name.toLowerCase()))
    const additions = chars.filter((c) => c.name && !known.has(c.name.toLowerCase()))
    if (additions.length === 0) return
    // Cap the roster so a runaway story can't bloat the doc.
    const merged = [...existing, ...additions].slice(0, 40)
    txn.update(ref, { characters: merged })
  })
}

export async function updateStoryRating(
  storyId: string,
  rating: ContentRating,
  byUid: string,
  override: boolean,
): Promise<void> {
  await storyRef(storyId).update({
    rating,
    ratingOverriddenBy: override ? byUid : null,
  })
}

export async function incrementStoryNodeCount(storyId: string) {
  await storyRef(storyId).update({ nodeCount: FieldValue.increment(1) })
}

/**
 * Best-effort popularity counter: a reader took the path `slotId` to its child.
 * Increments the slot (for "% went here") and the child node (for path reads).
 */
export async function incrementTraversal(
  storyId: string,
  nodeId: string,
  slotId: string,
  childNodeId: string,
): Promise<{ slotTraversals: number; submittedBy: string | null }> {
  const sRef = slotRef(storyId, nodeId, slotId)
  const cRef = nodeRef(storyId, childNodeId)
  // A transaction (not a blind batch) so we learn the exact resulting count and
  // the path's author in the same round trip — the caller no longer needs a
  // second read to detect the Path Pioneer milestone, and concurrent traversals
  // serialize so exactly one of them observes the threshold.
  return adminDb.runTransaction(async (txn) => {
    const slotDoc = await txn.get(sRef)
    const prev = (slotDoc.data()?.traversals as number) ?? 0
    const submittedBy = (slotDoc.data()?.submittedBy as string | undefined) ?? null
    txn.update(sRef, { traversals: FieldValue.increment(1) })
    txn.update(cRef, { traversals: FieldValue.increment(1) })
    return { slotTraversals: prev + 1, submittedBy }
  })
}

export interface GalleryImage {
  nodeId: string
  imageUrl: string
  choiceText: string | null
  excerpt: string
}

/** All illustrations in a story (published routes only), for the gallery. */
export async function getStoryGallery(storyId: string): Promise<GalleryImage[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`story-tree-${storyId}`, `story-${storyId}`)

  const snap = await nodesRef(storyId).limit(300).get()
  return snap.docs
    .map((d) => {
      const data = d.data()
      return {
        nodeId: d.id,
        imageUrl: (data.imageUrl as string) ?? '',
        choiceText: (data.choiceText as string) ?? null,
        excerpt: ((data.content as string) ?? '').slice(0, 120),
        published: data.published !== false,
      }
    })
    .filter((n) => n.imageUrl && n.published)
    .map(({ nodeId, imageUrl, choiceText, excerpt }) => ({ nodeId, imageUrl, choiceText, excerpt }))
}

export interface AuthoredPathStats {
  pathsWritten: number
  totalReads: number
  totalLoves: number
}

/**
 * Reputation stats for a writer: how many routes they've authored and the reads
 * and reactions those routes have accrued. Uses a collection-group query over
 * `nodes` (requires the nodes/authorId index).
 */
export async function getAuthoredPathStats(uid: string): Promise<AuthoredPathStats> {
  const snap = await adminDb.collectionGroup('nodes').where('authorId', '==', uid).limit(1000).get()
  let totalReads = 0
  let totalLoves = 0
  for (const d of snap.docs) {
    const data = d.data()
    totalReads += (data.traversals as number) ?? 0
    // Per-type reaction counts live in the node's `reactions` map, the single
    // source of truth (see firestore/reactions.ts) — sum it for total loves.
    const reactions = (data.reactions as Record<string, number>) ?? {}
    totalLoves += Object.values(reactions).reduce((sum, n) => sum + (n ?? 0), 0)
  }
  return { pathsWritten: snap.size, totalReads, totalLoves }
}

export async function getStoriesByWorld(worldId: string, limit = 100): Promise<Story[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories', `world-stories-${worldId}`)

  // Single-field `where` avoids needing a composite index; sort in memory.
  const snap = await adminDb.collection('stories').where('worldId', '==', worldId).limit(limit).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Story))
    .filter((s) => s.published !== false && !s.unlisted)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function getStoryCounts(): Promise<Record<string, number>> {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories')

  const snap = await adminDb.collection('stories').select('worldId', 'published').get()
  const counts: Record<string, number> = {}
  for (const doc of snap.docs) {
    const { worldId, published } = doc.data()
    if (published !== false && worldId) {
      counts[worldId] = (counts[worldId] ?? 0) + 1
    }
  }
  return counts
}

/** The reader's existing personal saga in a world, if any (one saga per player
 * per world). Reuses the author index — no extra composite index needed. */
export async function getUserSagaInWorld(uid: string, worldId: string): Promise<Story | null> {
  const mine = await getStoriesByAuthor(uid).catch(() => [])
  return mine.find((s) => s.youMode === true && s.worldId === worldId) ?? null
}

/** A reader began a personal saga from this chapter — bump its branch counter. */
export async function incrementSagaBranches(storyId: string, nodeId: string): Promise<void> {
  await nodeRef(storyId, nodeId).update({ sagaBranches: FieldValue.increment(1) })
}

export async function getStoriesByAuthor(authorId: string, limit = 100): Promise<Story[]> {
  const snap = await adminDb
    .collection('stories')
    .where('authorId', '==', authorId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story))
}

