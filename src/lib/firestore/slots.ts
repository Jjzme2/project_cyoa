import { adminDb } from '../firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { ChoiceSlot, ChoiceRequirement, ChoiceEffect } from '@/types'
import { slotRef } from './refs'
import { setNodeModeration } from './nodes'

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

/**
 * Toggle a community flag-to-remove vote on a filled slot.
 * Auto-removes the path when votes reach the intelligent threshold:
 *   max(5, ceil(traversals * 0.3))
 * Returns the new count, whether the user has now flagged it, and whether it was auto-removed.
 */
export async function flagSlotVote(
  storyId: string,
  nodeId: string,
  slotId: string,
  userId: string,
): Promise<{ flagVoteCount: number; userHasFlagged: boolean; autoRemoved: boolean }> {
  const ref = slotRef(storyId, nodeId, slotId)
  const doc = await ref.get()
  if (!doc.exists) throw new Error('Slot not found')

  const data = doc.data()!
  const flaggedBy: string[] = data.communityFlaggedBy ?? []
  const alreadyFlagged = flaggedBy.includes(userId)
  const traversals: number = data.traversals ?? 0
  const childNodeId: string | null = data.childNodeId ?? null

  const newCount = Math.max(0, (data.flagVoteCount ?? flaggedBy.length) + (alreadyFlagged ? -1 : 1))
  const userHasFlagged = !alreadyFlagged
  const threshold = Math.max(5, Math.ceil(traversals * 0.3))
  const shouldAutoRemove = userHasFlagged && newCount >= threshold && !!data.filled && !!childNodeId

  await ref.update({
    communityFlaggedBy: alreadyFlagged ? FieldValue.arrayRemove(userId) : FieldValue.arrayUnion(userId),
    flagVoteCount: FieldValue.increment(alreadyFlagged ? -1 : 1),
  })

  if (shouldAutoRemove && childNodeId) {
    await setNodeModeration(storyId, childNodeId, 'reject', '__community__')
  }

  return { flagVoteCount: newCount, userHasFlagged, autoRemoved: shouldAutoRemove }
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

