import { adminDb } from '../firebase-admin'
import type { SlotBounty } from '@/types'
import { CreditManager } from '../credit-manager'
import { slotRef } from './refs'
import { getChoiceSlot } from './slots'

// ─── Branch bounties (escrow on empty slots) ───────────────────────────────────────────────

export async function postBounty(
  storyId: string,
  nodeId: string,
  slotId: string,
  poster: { uid: string; name: string },
  reward: number,
  promptHint?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(reward) || reward <= 0) {
    return { ok: false, error: 'Reward must be a positive whole number of credits.' }
  }
  const slot = await getChoiceSlot(storyId, nodeId, slotId)
  if (!slot) return { ok: false, error: 'Slot not found.' }
  if (slot.filled) return { ok: false, error: 'This path has already been written.' }
  if (slot.bounty && slot.bounty.status === 'open') {
    return { ok: false, error: 'This path already has an open bounty.' }
  }

  const held = await CreditManager.holdPurchased(poster.uid, reward)
  if (!held) return { ok: false, error: 'Not enough purchased credits to fund this bounty.' }

  const bounty: SlotBounty = {
    reward,
    posterId: poster.uid,
    posterName: poster.name,
    promptHint: promptHint?.trim().slice(0, 200) || undefined,
    status: 'open',
    pendingClaimBy: null,
    pendingNodeId: null,
    createdAt: new Date().toISOString(),
  }
  try {
    await slotRef(storyId, nodeId, slotId).update({ bounty })
  } catch {
    await CreditManager.grantCredits(poster.uid, reward) // refund the hold
    return { ok: false, error: 'Could not place the bounty. Your credits were refunded.' }
  }
  return { ok: true }
}

/** Cancel an open, unclaimed bounty and refund the poster (poster only). */
export async function cancelBounty(
  storyId: string,
  nodeId: string,
  slotId: string,
  requesterId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ref = slotRef(storyId, nodeId, slotId)
  let refundAmount = 0
  let error: string | undefined
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const b = doc.data()?.bounty as SlotBounty | undefined
    if (!b || b.status !== 'open') {
      error = 'No open bounty to cancel.'
      return
    }
    if (b.posterId !== requesterId) {
      error = 'Only the poster can cancel this bounty.'
      return
    }
    if (b.pendingClaimBy) {
      error = 'A contribution is awaiting review — the bounty can’t be cancelled yet.'
      return
    }
    refundAmount = b.reward
    txn.update(ref, { 'bounty.status': 'refunded' })
    // Refund atomically with the status change — no paid-but-not-credited window.
    CreditManager.grantCreditsInTxn(txn, requesterId, refundAmount)
  })
  if (error) return { ok: false, error }
  return { ok: true }
}

/**
 * Settle a slot's bounty after it's been filled. Pays the filler when the
 * contribution is published, defers until approval when it's flagged, and
 * refunds the poster if they filled their own bounty.
 */
export async function settleBountyOnFill(
  storyId: string,
  nodeId: string,
  slotId: string,
  fillerId: string,
  childNodeId: string,
  published: boolean,
): Promise<void> {
  const ref = slotRef(storyId, nodeId, slotId)

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const b = doc.data()?.bounty as SlotBounty | undefined
    if (!b || b.status !== 'open') return
    if (b.posterId === fillerId) {
      // Can't claim your own bounty — refund the escrow, atomically.
      txn.update(ref, { 'bounty.status': 'refunded' })
      CreditManager.grantCreditsInTxn(txn, b.posterId, b.reward)
    } else if (published) {
      // Pay the filler in the same transaction as marking it paid.
      txn.update(ref, {
        'bounty.status': 'paid',
        'bounty.pendingClaimBy': null,
        'bounty.pendingNodeId': null,
      })
      CreditManager.grantCreditsInTxn(txn, fillerId, b.reward)
    } else {
      // Flagged — hold the reward until an admin approves the route.
      txn.update(ref, { 'bounty.pendingClaimBy': fillerId, 'bounty.pendingNodeId': childNodeId })
    }
  })
}

