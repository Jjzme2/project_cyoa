import { adminDb } from '../firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { ReactionType } from '@/types'
import { nodeRef } from './refs'

// ─── Node Reactions ───────────────────────────────────────────────────────────
/**
 * Per-type reaction counts are sharded across NUM_SHARDS documents per node so
 * that a popular chapter's many concurrent reactors don't all serialize on a
 * single document (Firestore's practical ceiling is ~1 sustained write/sec on
 * one doc). Each toggle picks a random shard and applies an atomic increment —
 * no read-modify-write, so concurrent toggles never contend with each other.
 * Nodes reacted to before this field existed keep their old `reactions` map as
 * a frozen baseline that shard sums are added on top of; no backfill needed.
 */
const NUM_SHARDS = 10

function userReactionRef(userId: string, storyId: string, nodeId: string) {
  return adminDb.collection('userReactions').doc(`${userId}_${storyId}_${nodeId}`)
}

function reactionShardsRef(storyId: string, nodeId: string) {
  return nodeRef(storyId, nodeId).collection('reactionShards')
}

async function sumReactionCounts(storyId: string, nodeId: string): Promise<Record<string, number>> {
  const [nodeDoc, shardSnap] = await Promise.all([
    nodeRef(storyId, nodeId).get(),
    reactionShardsRef(storyId, nodeId).get(),
  ])

  const counts: Record<string, number> = { ...((nodeDoc.data()?.reactions as Record<string, number>) ?? {}) }
  for (const doc of shardSnap.docs) {
    for (const [reaction, n] of Object.entries(doc.data() ?? {})) {
      if (typeof n === 'number') counts[reaction] = (counts[reaction] ?? 0) + n
    }
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

  const shardId = String(Math.floor(Math.random() * NUM_SHARDS))
  await Promise.all([
    reactionShardsRef(storyId, nodeId).doc(shardId).set({ [reaction]: FieldValue.increment(delta) }, { merge: true }),
    nodeRef(storyId, nodeId).update({ totalReactions: FieldValue.increment(delta) }),
  ])

  const counts = await sumReactionCounts(storyId, nodeId)
  return { counts, userReactions: finalUserReactions }
}

export async function getNodeReactions(
  userId: string | null,
  storyId: string,
  nodeId: string,
): Promise<{ counts: Record<string, number>; userReactions: string[] }> {
  const [counts, userDoc] = await Promise.all([
    sumReactionCounts(storyId, nodeId),
    userId ? userReactionRef(userId, storyId, nodeId).get() : Promise.resolve(null),
  ])
  const userReactions: string[] = userDoc?.exists ? (userDoc.data()?.reactions ?? []) : []
  return { counts, userReactions }
}
