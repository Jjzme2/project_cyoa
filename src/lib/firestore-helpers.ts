import { adminDb } from './firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'
import { StoryPathSegment } from '@/types'
import type {
  Story, StoryNode, ChoiceSlot, World, ChoiceRequirement, ChoiceEffect,
  Bookmark, Notification, NotificationType, UserAchievements, ReactionType, StoryTreeNode,
} from '@/types'
import { ACHIEVEMENT_DEFS } from '@/types'
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
      .filter((s) => s.published !== false)
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

export async function incrementStoryNodeCount(storyId: string) {
  await storyRef(storyId).update({ nodeCount: FieldValue.increment(1) })
}

// ─── Worlds ──────────────────────────────────────────────────────────────────

export async function getWorld(id: string): Promise<World | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(`world-${id}`, 'worlds')

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
  'use cache'
  cacheLife('minutes')
  cacheTag(`node-${storyId}-${nodeId}`)

  const doc = await nodeRef(storyId, nodeId).get()
  if (!doc.exists) return null

  const slotsSnap = await slotsRef(storyId, nodeId).orderBy('slotIndex').get()
  const slotsRaw: ChoiceSlot[] = slotsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ChoiceSlot),
  )

  // Batch-fetch all filled child nodes in a single round trip to check for illustrations.
  const filledWithChild = slotsRaw.filter((s) => s.filled && s.childNodeId)
  let slots: ChoiceSlot[] = slotsRaw
  if (filledWithChild.length > 0) {
    try {
      const refs = filledWithChild.map((s) => nodeRef(storyId, s.childNodeId!))
      const childDocs = await adminDb.getAll(...refs)
      const imageMap = new Map(
        childDocs.map((doc, i) => [filledWithChild[i].childNodeId!, !!doc.data()?.imageUrl]),
      )
      slots = slotsRaw.map((slot) =>
        slot.filled && slot.childNodeId && imageMap.has(slot.childNodeId)
          ? { ...slot, childHasImage: imageMap.get(slot.childNodeId) }
          : slot,
      )
    } catch (err) {
      console.error('[getStoryNode] Batch child image check failed:', err)
    }
  }

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
  'use cache'
  cacheLife('days')
  cacheTag(`path-${storyId}-${nodeId}`)

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
    segments.push({
      id: doc.id,
      content: data.content ?? '',
      choiceText: data.choiceText ?? null,
      depth: data.depth ?? 0,
    })
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

// ─── Public Worlds ────────────────────────────────────────────────────────────

export async function getPublicWorlds(limit = 100): Promise<World[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('worlds')

  const snap = await adminDb.collection('worlds').orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as World))
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

// ─── Bookmarks ────────────────────────────────────────────────────────────────

function bookmarkRef(userId: string, storyId: string) {
  return adminDb.collection('bookmarks').doc(`${userId}_${storyId}`)
}

export async function createBookmark(userId: string, story: Story): Promise<void> {
  await bookmarkRef(userId, story.id).set({
    userId,
    storyId: story.id,
    storyTitle: story.title,
    storyAuthorName: story.authorName,
    worldName: story.worldName,
    coverGradient: story.coverGradient ?? '',
    createdAt: new Date().toISOString(),
  })
}

export async function deleteBookmark(userId: string, storyId: string): Promise<void> {
  await bookmarkRef(userId, storyId).delete()
}

export async function isBookmarked(userId: string, storyId: string): Promise<boolean> {
  const doc = await bookmarkRef(userId, storyId).get()
  return doc.exists
}

export async function getUserBookmarks(userId: string): Promise<Bookmark[]> {
  const snap = await adminDb
    .collection('bookmarks')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bookmark))
}

// ─── Notifications ────────────────────────────────────────────────────────────

function notifCollection(userId: string) {
  return adminDb.collection('users').doc(userId).collection('notifications')
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  data: Partial<Omit<Notification, 'id' | 'userId' | 'type' | 'read' | 'createdAt'>>,
): Promise<void> {
  await notifCollection(userId).add({
    userId,
    type,
    ...data,
    read: false,
    createdAt: new Date().toISOString(),
  })
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const snap = await notifCollection(userId)
    .orderBy('createdAt', 'desc')
    .limit(40)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
}

export async function markNotificationRead(userId: string, notifId: string): Promise<void> {
  await notifCollection(userId).doc(notifId).update({ read: true })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await notifCollection(userId).where('read', '==', false).get()
  if (snap.empty) return
  const batch = adminDb.batch()
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}

// ─── Achievements ─────────────────────────────────────────────────────────────

function achievementsRef(userId: string) {
  return adminDb.collection('achievements').doc(userId)
}

export async function getUserAchievements(userId: string): Promise<UserAchievements> {
  const doc = await achievementsRef(userId).get()
  if (!doc.exists) {
    return {
      earned: [],
      counts: { contributions: 0, storiesRead: 0, bookmarks: 0, worlds: 0, stories: 0, illustrations: 0 },
      updatedAt: new Date().toISOString(),
    }
  }
  return doc.data() as UserAchievements
}

export async function checkAndAwardAchievements(
  userId: string,
  event: 'contribution' | 'illustration' | 'world_created' | 'story_created' | 'story_read' | 'bookmark',
): Promise<string[]> {
  const ref = achievementsRef(userId)
  const newlyEarned: string[] = []

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const data: UserAchievements = doc.exists
      ? (doc.data() as UserAchievements)
      : {
          earned: [],
          counts: { contributions: 0, storiesRead: 0, bookmarks: 0, worlds: 0, stories: 0, illustrations: 0 },
          updatedAt: new Date().toISOString(),
        }

    const counts = { ...data.counts }
    const earned = [...data.earned]

    if (event === 'contribution') counts.contributions = (counts.contributions ?? 0) + 1
    if (event === 'illustration') counts.illustrations = (counts.illustrations ?? 0) + 1
    if (event === 'world_created') counts.worlds = (counts.worlds ?? 0) + 1
    if (event === 'story_created') counts.stories = (counts.stories ?? 0) + 1
    if (event === 'story_read') counts.storiesRead = (counts.storiesRead ?? 0) + 1
    if (event === 'bookmark') counts.bookmarks = (counts.bookmarks ?? 0) + 1

    function check(id: string, condition: boolean) {
      if (condition && !earned.includes(id)) {
        earned.push(id)
        newlyEarned.push(id)
      }
    }

    check('first_step', counts.contributions >= 1)
    check('prolific', counts.contributions >= 10)
    check('chronicler', counts.contributions >= 50)
    check('sage', counts.contributions >= 100)
    check('illustrator', counts.illustrations >= 1)
    check('world_builder', counts.worlds >= 1)
    check('storyteller', counts.stories >= 1)
    check('explorer', counts.storiesRead >= 5)
    check('bookworm', counts.storiesRead >= 10)
    check('librarian', counts.bookmarks >= 10)

    txn.set(ref, { earned, counts, updatedAt: new Date().toISOString() })
  })

  return newlyEarned
}

// ─── Node Reactions ───────────────────────────────────────────────────────────

function userReactionRef(userId: string, storyId: string, nodeId: string) {
  return adminDb.collection('userReactions').doc(`${userId}_${storyId}_${nodeId}`)
}

export async function toggleNodeReaction(
  userId: string,
  storyId: string,
  nodeId: string,
  reaction: ReactionType,
): Promise<{ counts: Record<string, number>; userReactions: string[] }> {
  const userRef = userReactionRef(userId, storyId, nodeId)
  const nodeDocRef = adminDb.collection('stories').doc(storyId).collection('nodes').doc(nodeId)
  let finalUserReactions: string[] = []
  let finalCounts: Record<string, number> = {}

  await adminDb.runTransaction(async (txn) => {
    const [userDoc, nodeDoc] = await Promise.all([txn.get(userRef), txn.get(nodeDocRef)])
    const userReactions: string[] = userDoc.exists ? (userDoc.data()?.reactions ?? []) : []
    const nodeCounts: Record<string, number> = nodeDoc.exists
      ? (nodeDoc.data()?.reactions ?? {})
      : {}

    if (userReactions.includes(reaction)) {
      finalUserReactions = userReactions.filter((r) => r !== reaction)
      nodeCounts[reaction] = Math.max(0, (nodeCounts[reaction] ?? 0) - 1)
    } else {
      finalUserReactions = [...userReactions, reaction]
      nodeCounts[reaction] = (nodeCounts[reaction] ?? 0) + 1
    }

    finalCounts = nodeCounts
    txn.set(userRef, { reactions: finalUserReactions, updatedAt: new Date().toISOString() })
    txn.update(nodeDocRef, { reactions: nodeCounts })
  })

  return { counts: finalCounts, userReactions: finalUserReactions }
}

export async function getNodeReactions(
  userId: string | null,
  storyId: string,
  nodeId: string,
): Promise<{ counts: Record<string, number>; userReactions: string[] }> {
  const nodeDocRef = adminDb.collection('stories').doc(storyId).collection('nodes').doc(nodeId)
  const [nodeDoc, userDoc] = await Promise.all([
    nodeDocRef.get(),
    userId ? userReactionRef(userId, storyId, nodeId).get() : Promise.resolve(null),
  ])
  const counts: Record<string, number> = nodeDoc.exists ? (nodeDoc.data()?.reactions ?? {}) : {}
  const userReactions: string[] = userDoc?.exists ? (userDoc.data()?.reactions ?? []) : []
  return { counts, userReactions }
}

// ─── Reading History ──────────────────────────────────────────────────────────

export async function getUserReadingHistory(
  userId: string,
  limit = 20,
): Promise<Array<{ progress: ReadingProgress; story: Story | null }>> {
  const snap = await adminDb
    .collection('readingProgress')
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get()

  if (snap.empty) return []

  const progressDocs = snap.docs.map((d) => d.data() as ReadingProgress & { storyId: string })
  const stories = await Promise.all(
    progressDocs.map((p) => getStory(p.storyId).catch(() => null)),
  )

  return progressDocs.map((progress, i) => ({ progress, story: stories[i] }))
}

// ─── Story Tree (for dashboard) ───────────────────────────────────────────────

export async function getStoriesByAuthor(authorId: string): Promise<Story[]> {
  const snap = await adminDb
    .collection('stories')
    .where('authorId', '==', authorId)
    .orderBy('createdAt', 'desc')
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story))
}

export async function getStoryTree(storyId: string): Promise<StoryTreeNode[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`story-tree-${storyId}`)

  const snap = await adminDb
    .collection('stories')
    .doc(storyId)
    .collection('nodes')
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get()

  if (snap.empty) return []

  const allNodes = snap.docs.map((d) => {
    const data = d.data()
    return {
      nodeId: d.id,
      content: data.content ?? '',
      depth: data.depth ?? 0,
      choiceText: data.choiceText ?? null,
      imageUrl: data.imageUrl ?? null,
      aiGenerated: data.aiGenerated ?? false,
      parentId: data.parentId ?? null,
      createdAt: data.createdAt ?? '',
      slots: [] as StoryTreeNode['slots'],
      children: [] as StoryTreeNode[],
    }
  })

  // Single collection group query for all slots in this story — replaces N parallel subcollection reads
  const allSlotsSnap = await adminDb
    .collectionGroup('slots')
    .where('storyId', '==', storyId)
    .orderBy('slotIndex')
    .get()

  const slotsByNode = new Map<string, StoryTreeNode['slots']>()
  for (const d of allSlotsSnap.docs) {
    const sd = d.data()
    const nid = sd.nodeId as string
    if (!slotsByNode.has(nid)) slotsByNode.set(nid, [])
    slotsByNode.get(nid)!.push({
      id: d.id,
      slotIndex: sd.slotIndex ?? 0,
      filled: sd.filled ?? false,
      promptText: sd.promptText ?? null,
      submitterName: sd.submitterName ?? null,
      childNodeId: sd.childNodeId ?? null,
    })
  }

  const nodeMap = new Map<string, typeof allNodes[0] & { slots: StoryTreeNode['slots'] }>()
  allNodes.forEach((n) => {
    nodeMap.set(n.nodeId, { ...n, slots: slotsByNode.get(n.nodeId) ?? [] })
  })

  const roots: StoryTreeNode[] = []
  allNodes.forEach((n) => {
    const node = nodeMap.get(n.nodeId)!
    if (!n.parentId) {
      roots.push(node as unknown as StoryTreeNode)
    } else {
      const parent = nodeMap.get(n.parentId)
      if (parent) {
        ;(parent as unknown as StoryTreeNode).children.push(node as unknown as StoryTreeNode)
      }
    }
  })

  return roots
}
