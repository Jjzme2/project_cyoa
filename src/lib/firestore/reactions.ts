import { adminDb } from '../firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { ReactionType } from '@/types'
import { nodeRef } from './refs'

// ─── Node Reactions ───────────────────────────────────────────────────────────
/**
 * Per-type reaction counts live in a single `reactions` map on the node doc,
 * mutated with atomic per-field increments (`reactions.<type>` += ±1) — no
 * read-modify-write, so concurrent reactors never contend or lose updates.
 * A chapter view therefore costs one node read (plus the viewer's own
 * reaction doc), and "most loved" rollups sum this map straight off the node.
 *
 * (An earlier revision sharded these counts across sub-docs to lift the
 * single-doc write ceiling, but at this app's scale no chapter sustains the
 * >1 write/sec that would justify it, and the shard fan-out multiplied the
 * per-view read cost with no real contention to relieve.)
 */

function userReactionRef(userId: string, storyId: string, nodeId: string) {
  return adminDb.collection('userReactions').doc(`${userId}_${storyId}_${nodeId}`)
}

function readCounts(data: FirebaseFirestore.DocumentData | undefined): Record<string, number> {
  const raw = (data?.reactions as Record<string, number>) ?? {}
  const counts: Record<string, number> = {}
  for (const [reaction, n] of Object.entries(raw)) {
    if (typeof n === 'number' && n > 0) counts[reaction] = n
  }
  return counts
}

export async function toggleNodeReaction(
  userId: string,
  storyId: string,
  nodeId: string,
  reaction: ReactionType,
): Promise<{ counts: Record<string, number>; userReactions: string[] }> {
  const userRef = userReactionRef(userId, storyId, nodeId)
  const node = nodeRef(storyId, nodeId)

  // The user's own set of reactions is a genuine read-modify-write (toggle), so
  // it stays in a transaction; the aggregate count is a blind atomic increment.
  const { delta, finalUserReactions } = await adminDb.runTransaction(async (txn) => {
    const userDoc = await txn.get(userRef)
    const userReactions: string[] = userDoc.exists ? (userDoc.data()?.reactions ?? []) : []
    const alreadyReacted = userReactions.includes(reaction)
    const finalUserReactions = alreadyReacted
      ? userReactions.filter((r) => r !== reaction)
      : [...userReactions, reaction]
    txn.set(userRef, { reactions: finalUserReactions, updatedAt: new Date().toISOString() })
    return { delta: alreadyReacted ? -1 : 1, finalUserReactions }
  })

  await node.update({ [`reactions.${reaction}`]: FieldValue.increment(delta) })

  const nodeDoc = await node.get()
  return { counts: readCounts(nodeDoc.data()), userReactions: finalUserReactions }
}

export async function getNodeReactions(
  userId: string | null,
  storyId: string,
  nodeId: string,
): Promise<{ counts: Record<string, number>; userReactions: string[] }> {
  const [nodeDoc, userDoc] = await Promise.all([
    nodeRef(storyId, nodeId).get(),
    userId ? userReactionRef(userId, storyId, nodeId).get() : Promise.resolve(null),
  ])
  const userReactions: string[] = userDoc?.exists ? (userDoc.data()?.reactions ?? []) : []
  return { counts: readCounts(nodeDoc.data()), userReactions }
}
