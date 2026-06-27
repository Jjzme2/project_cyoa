import { adminDb } from '../firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'
import type { ChoiceSlot, ModerationStatus, NodeModeration, SlotBounty, StoryNode, StoryPathSegment } from '@/types'
import { CreditManager } from '../credit-manager'
import { storyRef, nodesRef, nodeRef, slotsRef } from './refs'

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

  // Settle any bounty on the parent slot that was awaiting this node's review.
  const snap = await ref.get()
  const parentId = snap.data()?.parentId as string | null | undefined
  if (!parentId) return
  const slotMatches = await slotsRef(storyId, parentId).where('childNodeId', '==', nodeId).get()
  if (slotMatches.empty) {
    // On reject the slot was already detached below; nothing to do.
  }

  if (action === 'approve') {
    for (const d of slotMatches.docs) {
      const b = d.data()?.bounty as SlotBounty | undefined
      if (b && b.status === 'open' && b.pendingNodeId === nodeId && b.pendingClaimBy) {
        await d.ref.update({ 'bounty.status': 'paid', 'bounty.pendingClaimBy': null, 'bounty.pendingNodeId': null })
        await CreditManager.grantCredits(b.pendingClaimBy, b.reward)
      }
    }
    return
  }

  // Rejecting a route frees the parent slot so the community can rewrite it,
  // and returns any pending bounty to the open pool (escrow stays held).
  const batch = adminDb.batch()
  slotMatches.docs.forEach((d) => {
    const update: Record<string, unknown> = {
      filled: false,
      childNodeId: null,
      locked: false,
      lockedBy: null,
      lockedAt: null,
    }
    const b = d.data()?.bounty as SlotBounty | undefined
    if (b && b.pendingNodeId === nodeId) {
      update['bounty.pendingClaimBy'] = null
      update['bounty.pendingNodeId'] = null
    }
    batch.update(d.ref, update)
  })
  if (!slotMatches.empty) await batch.commit()
}

/**
 * Escrow a reward on an empty slot. Holds the reward from the poster's
 * purchased credits; refunds automatically if the slot write fails.
 */
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

/**
 * Build a personal saga's opening tree in one shot.
 *
 * A saga has no single authored opening — instead the reader picks among several
 * entry points (doorways into the world). This writes a depth-0 "threshold" node
 * whose slots ARE those entry points: each slot is pre-filled and points to an
 * already-rendered opening chapter (depth 1) with its own onward choices. The
 * threshold has exactly as many slots as there are entry points (no empty
 * "write path N" slots), so readers simply choose where their story begins.
 *
 * Returns the threshold node's id (the story's root).
 */
export async function createSagaTree(
  storyId: string,
  thresholdContent: string,
  authorId: string,
  openings: { label: string; content: string; choices: string[]; aiModel: string }[],
): Promise<{ rootNodeId: string; nodeCount: number }> {
  const rootRef = nodesRef(storyId).doc()
  const rootId = rootRef.id

  // Render each entry point's opening as a depth-1 child with its own 3 onward
  // choices, so the normal collaborative flow continues from there.
  const childIds = await Promise.all(
    openings.map((o) =>
      createStoryNode(
        {
          storyId,
          content: o.content,
          depth: 1,
          parentId: rootId,
          choiceText: o.label,
          authorId,
          aiGenerated: true,
          aiModel: o.aiModel,
          imageUrl: null,
        },
        o.choices,
      ),
    ),
  )

  // The threshold node itself — short framing prose, no author choices to fill.
  await rootRef.set({
    storyId,
    content: thresholdContent,
    depth: 0,
    parentId: null,
    choiceText: null,
    authorId,
    aiGenerated: false,
    aiModel: null,
    imageUrl: null,
    published: true,
    moderation: { status: 'approved', reviewedBy: null, reviewedAt: null },
    createdAt: new Date().toISOString(),
  })

  // One pre-filled slot per entry point, in author order.
  const now = new Date().toISOString()
  const batch = adminDb.batch()
  openings.forEach((o, i) => {
    const slot = slotsRef(storyId, rootId).doc()
    batch.set(slot, {
      nodeId: rootId,
      storyId,
      slotIndex: i,
      promptText: o.label,
      filled: true,
      childNodeId: childIds[i],
      submittedBy: authorId,
      // Entry-point doorways are part of the saga's framing, not a community
      // contribution — leave them unattributed so the threshold reads cleanly.
      submitterName: null,
      locked: false,
      lockedBy: null,
      lockedAt: null,
      createdAt: now,
    })
  })
  await batch.commit()

  const nodeCount = openings.length + 1
  await storyRef(storyId).update({ rootNodeId: rootId, nodeCount, updatedAt: now })

  return { rootNodeId: rootId, nodeCount }
}

// ─── Choice Slots ─────────────────────────────────────────────────────────────

