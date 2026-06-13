import { adminDb } from './firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'
import { StoryPathSegment } from '@/types'
import type {
  Story, StoryNode, ChoiceSlot, World, ChoiceRequirement, ChoiceEffect,
  Bookmark, Notification, NotificationType, UserAchievements, ReactionType, StoryTreeNode,
  NodeModeration, ModerationStatus, ContentRating,
} from '@/types'
import { ACHIEVEMENT_DEFS } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'
import { decrypt } from './encrypt'
import { ratingRank } from './ratings'

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

export async function getStoryNode(
  storyId: string,
  nodeId: string,
  includeUnpublished = false,
): Promise<StoryNode | null> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`node-${storyId}-${nodeId}`)

  const doc = await nodeRef(storyId, nodeId).get()
  if (!doc.exists) return null

  const nodeData = doc.data()!
  // Unpublished (flagged / admin-rejected) routes are visible to admins only.
  const nodePublished = nodeData.published !== false
  if (!nodePublished && !includeUnpublished) return null

  const slotsSnap = await slotsRef(storyId, nodeId).orderBy('slotIndex').get()
  const slotsRaw: ChoiceSlot[] = slotsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ChoiceSlot),
  )

  // Batch-fetch filled child nodes in a single round trip for illustration +
  // moderation state.
  const filledWithChild = slotsRaw.filter((s) => s.filled && s.childNodeId)
  let slots: ChoiceSlot[] = slotsRaw
  if (filledWithChild.length > 0) {
    try {
      const refs = filledWithChild.map((s) => nodeRef(storyId, s.childNodeId!))
      const childDocs = await adminDb.getAll(...refs)
      const childInfo = new Map(
        childDocs.map((d, i) => {
          const data = d.data()
          return [
            filledWithChild[i].childNodeId!,
            {
              hasImage: !!data?.imageUrl,
              published: data?.published !== false,
              status: (data?.moderation?.status ?? 'approved') as ModerationStatus,
            },
          ]
        }),
      )
      slots = slotsRaw.map((slot) => {
        if (!slot.filled || !slot.childNodeId) return slot
        const info = childInfo.get(slot.childNodeId)
        if (!info) return slot
        if (!info.published && !includeUnpublished) {
          // Hide the route's destination from readers; not re-writable either.
          return { ...slot, childNodeId: null, pendingReview: true, childHasImage: false }
        }
        return { ...slot, childHasImage: info.hasImage, childModeration: info.status }
      })
    } catch (err) {
      console.error('[getStoryNode] Batch child fetch failed:', err)
    }
  }

  return { id: doc.id, ...nodeData, published: nodePublished, slots } as StoryNode
}

export async function setNodeModeration(
  storyId: string,
  nodeId: string,
  action: 'approve' | 'reject',
  reviewerUid: string,
): Promise<void> {
  const ref = nodeRef(storyId, nodeId)
  const status: ModerationStatus = action === 'approve' ? 'approved' : 'rejected'

  await ref.update({
    published: action === 'approve',
    'moderation.status': status,
    'moderation.reviewedBy': reviewerUid,
    'moderation.reviewedAt': new Date().toISOString(),
  })

  // Rejecting a route frees the parent slot so the community can rewrite it.
  if (action === 'reject') {
    const snap = await ref.get()
    const parentId = snap.data()?.parentId as string | null | undefined
    if (parentId) {
      const slotMatches = await slotsRef(storyId, parentId).where('childNodeId', '==', nodeId).get()
      if (!slotMatches.empty) {
        const batch = adminDb.batch()
        slotMatches.docs.forEach((d) =>
          batch.update(d.ref, {
            filled: false,
            childNodeId: null,
            locked: false,
            lockedBy: null,
            lockedAt: null,
          }),
        )
        await batch.commit()
      }
    }
  }
}

export interface ModerationQueueItem {
  storyId: string
  storyTitle: string
  nodeId: string
  parentId: string | null
  content: string
  choiceText: string | null
  categories: string[]
  reason: string | null
  authorId: string | null
  createdAt: string
}

export async function getModerationQueue(limit = 50): Promise<ModerationQueueItem[]> {
  const snap = await adminDb
    .collectionGroup('nodes')
    .where('moderation.status', '==', 'flagged')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()

  if (snap.empty) return []

  const storyIds = [...new Set(snap.docs.map((d) => d.data().storyId as string).filter(Boolean))]
  const storyDocs = await Promise.all(storyIds.map((sid) => storyRef(sid).get()))
  const titleMap = new Map(storyDocs.map((d) => [d.id, (d.data()?.title as string) ?? 'Untitled']))

  return snap.docs.map((d) => {
    const data = d.data()
    return {
      storyId: data.storyId,
      storyTitle: titleMap.get(data.storyId) ?? 'Untitled',
      nodeId: d.id,
      parentId: data.parentId ?? null,
      content: data.content ?? '',
      choiceText: data.choiceText ?? null,
      categories: data.moderation?.categories ?? [],
      reason: data.moderation?.reason ?? null,
      authorId: data.authorId ?? null,
      createdAt: data.createdAt ?? '',
    }
  })
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
  data: Omit<StoryNode, 'id' | 'createdAt' | 'slots' | 'published' | 'moderation'>,
  choiceSuggestions: string[] = [],
  moderationFields?: { published: boolean; moderation: NodeModeration },
): Promise<string> {
  const ref = nodesRef(data.storyId).doc()
  const published = moderationFields?.published ?? true
  const moderation: NodeModeration =
    moderationFields?.moderation ?? { status: 'approved', reviewedBy: null, reviewedAt: null }
  await ref.set({ ...data, published, moderation, createdAt: new Date().toISOString() })

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

export async function getStoriesByWorld(worldId: string, limit = 100): Promise<Story[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories', `world-stories-${worldId}`)

  // Single-field `where` avoids needing a composite index; sort in memory.
  const snap = await adminDb.collection('stories').where('worldId', '==', worldId).limit(limit).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Story))
    .filter((s) => s.published !== false)
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
