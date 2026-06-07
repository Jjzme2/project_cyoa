import { adminDb } from './firebase-admin'
import { StoryPathSegment } from '@/types'
import type { Story, StoryNode, ChoiceSlot, World, ChoiceRequirement, ChoiceEffect } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'
import { decrypt } from './encrypt'

// ─── Path helpers ─────────────────────────────────────────────────────────────

function storyRef(storyId: string) {
  return adminDb.collection('stories').doc(storyId)
}

function nodesRef(storyId: string) {
  return storyRef(storyId).collection('nodes')
}

function nodeRef(storyId: string, nodeId: string) {
  return nodesRef(storyId).doc(nodeId)
}

function slotsRef(storyId: string, nodeId: string) {
  return nodeRef(storyId, nodeId).collection('slots')
}

function slotRef(storyId: string, nodeId: string, slotId: string) {
  return slotsRef(storyId, nodeId).doc(slotId)
}

// ─── Stories ─────────────────────────────────────────────────────────────────

export async function getStories(limit = 20): Promise<Story[]> {
  try {
    const snap = await adminDb
      .collection('stories')
      .orderBy('createdAt', 'desc')
      .limit(limit * 2)
      .get()

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Story))
      .filter((s) => s.published !== false)
      .slice(0, limit)
  } catch (err) {
    console.error('[getStories] orderBy failed, falling back to scan:', (err as Error).message)
    const fallback = await adminDb.collection('stories').limit(limit).get()
    return fallback.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Story))
      .filter((s) => s.published !== false)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }
}

export async function getStory(id: string): Promise<Story | null> {
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

export async function incrementStoryNodeCount(storyId: string) {
  await storyRef(storyId).update({ nodeCount: FieldValue.increment(1) })
}

// ─── Worlds ──────────────────────────────────────────────────────────────────

export async function getWorld(id: string): Promise<World | null> {
  const doc = await adminDb.collection('worlds').doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as World
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

// ─── Story Nodes ──────────────────────────────────────────────────────────────

export async function getStoryNode(storyId: string, nodeId: string): Promise<StoryNode | null> {
  const doc = await nodeRef(storyId, nodeId).get()
  if (!doc.exists) return null

  const slotsSnap = await slotsRef(storyId, nodeId).orderBy('slotIndex').get()
  const slotsRaw: ChoiceSlot[] = slotsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ChoiceSlot),
  )

  // Dynamically query target child nodes in parallel to check for illustrations.
  // This solves backward compatibility and ensures illustrated pages get highlighted.
  const slots = await Promise.all(
    slotsRaw.map(async (slot) => {
      if (slot.filled && slot.childNodeId) {
        try {
          const childDoc = await nodeRef(storyId, slot.childNodeId).get()
          if (childDoc.exists) {
            const childData = childDoc.data()
            return {
              ...slot,
              childHasImage: !!childData?.imageUrl,
            }
          }
        } catch (err) {
          console.error(`[getStoryNode] Failed to check image for child node ${slot.childNodeId}:`, err)
        }
      }
      return slot
    })
  )

  return { id: doc.id, ...doc.data(), slots } as StoryNode
}

/**
 * Traverses backwards from a leaf node to the root node of the story,
 * constructing the complete chronological path of chapters.
 *
 * @param storyId The ID of the story.
 * @param nodeId The leaf node ID (e.g. parent node of the current slot).
 * @returns A promise resolving to an array of StoryPathSegment.
 */
export async function getStoryPath(storyId: string, nodeId: string): Promise<StoryPathSegment[]> {
  const segments: StoryPathSegment[] = []
  let currentId: string | null = nodeId
  const maxDepth = 40 // Safe-guard limit to prevent infinite loops and limit DB reads
  let count = 0

  while (currentId && count < maxDepth) {
    const docId: string = currentId
    const doc = await nodeRef(storyId, docId).get()
    if (!doc.exists) break
    const data = doc.data()
    if (!data) break
    segments.push(
      new StoryPathSegment(
        doc.id,
        data.content ?? '',
        data.choiceText ?? null,
        data.depth ?? 0
      )
    )
    currentId = data.parentId ?? null
    count++
  }

  // Reverse so that the root node is first and the leaf node is last
  return segments.reverse()
}

export async function createStoryNode(
  data: Omit<StoryNode, 'id' | 'createdAt' | 'slots'>,
  choiceSuggestions: string[] = [],
): Promise<string> {
  const ref = nodesRef(data.storyId).doc()
  await ref.set({ ...data, createdAt: new Date().toISOString() })

  const batch = adminDb.batch()
  for (let i = 0; i < 3; i++) {
    const slotRef = slotsRef(data.storyId, ref.id).doc()
    batch.set(slotRef, {
      nodeId: ref.id,
      storyId: data.storyId,
      slotIndex: i,
      promptText: choiceSuggestions[i] ?? null,
      filled: false,
      childNodeId: null,
      submittedBy: null,
      submitterName: null,
      locked: false,
      lockedBy: null,
      lockedAt: null,
      createdAt: new Date().toISOString(),
    })
  }
  await batch.commit()

  return ref.id
}

// ─── Choice Slots ─────────────────────────────────────────────────────────────

export async function getChoiceSlot(
  storyId: string,
  nodeId: string,
  slotId: string,
): Promise<ChoiceSlot | null> {
  const doc = await slotRef(storyId, nodeId, slotId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as ChoiceSlot
}

export async function fillChoiceSlot(
  storyId: string,
  nodeId: string,
  slotId: string,
  childNodeId: string,
  submittedBy: string,
  submitterName: string,
  promptText: string,
  requirements?: ChoiceRequirement[],
  effects?: ChoiceEffect[],
) {
  await slotRef(storyId, nodeId, slotId).update({
    filled: true,
    locked: false,
    lockedBy: null,
    lockedAt: null,
    childNodeId,
    submittedBy,
    submitterName,
    promptText,
    ...(requirements ? { requirements } : {}),
    ...(effects ? { effects } : {}),
  })
}

const LOCK_TTL_MS = 5 * 60 * 1000

export type LockResult = 'ok' | 'filled' | 'locked'

export async function lockChoiceSlot(
  storyId: string,
  nodeId: string,
  slotId: string,
  uid: string,
): Promise<LockResult> {
  const ref = slotRef(storyId, nodeId, slotId)
  let result: LockResult = 'ok'

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) { result = 'locked'; return }

    const data = doc.data()!
    if (data.filled) { result = 'filled'; return }

    if (data.locked && data.lockedAt) {
      const age = Date.now() - new Date(data.lockedAt).getTime()
      if (age < LOCK_TTL_MS) { result = 'locked'; return }
    }

    txn.update(ref, {
      locked: true,
      lockedBy: uid,
      lockedAt: new Date().toISOString(),
    })
  })

  return result
}

export async function releaseChoiceSlot(storyId: string, nodeId: string, slotId: string) {
  await slotRef(storyId, nodeId, slotId).update({
    locked: false,
    lockedBy: null,
    lockedAt: null,
  })
}

// ─── Reading Progress ─────────────────────────────────────────────────────────

export interface ReadingProgress {
  currentNodeId: string
  nodeHistory: string[]
  updatedAt: string
}

function progressRef(userId: string, storyId: string) {
  return adminDb.collection('readingProgress').doc(`${userId}_${storyId}`)
}

export async function getReadingProgress(
  userId: string,
  storyId: string,
): Promise<ReadingProgress | null> {
  const doc = await progressRef(userId, storyId).get()
  if (!doc.exists) return null
  return doc.data() as ReadingProgress
}

export async function saveReadingProgress(
  userId: string,
  storyId: string,
  currentNodeId: string,
  nodeHistory: string[],
) {
  await progressRef(userId, storyId).set({
    userId,
    storyId,
    currentNodeId,
    nodeHistory,
    updatedAt: new Date().toISOString(),
  })
}

// ─── User API Keys ─────────────────────────────────────────────────────────────

function userSettingsRef(userId: string) {
  return adminDb.collection('userSettings').doc(userId)
}

export async function getUserApiKey(userId: string): Promise<string | null> {
  const doc = await userSettingsRef(userId).get()
  return doc.exists ? (doc.data()?.encryptedGeminiKey ?? null) : null
}

export async function saveUserApiKey(userId: string, encryptedKey: string) {
  await userSettingsRef(userId).set({ encryptedGeminiKey: encryptedKey }, { merge: true })
}

export async function deleteUserApiKey(userId: string) {
  await userSettingsRef(userId).update({ encryptedGeminiKey: null })
}

export async function getDecryptedUserApiKey(userId: string): Promise<string | null> {
  const encrypted = await getUserApiKey(userId)
  if (!encrypted) return null
  try {
    return decrypt(encrypted)
  } catch {
    return null
  }
}
