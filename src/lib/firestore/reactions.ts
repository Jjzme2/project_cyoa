import { adminDb } from '../firebase-admin'
import type { ReactionType } from '@/types'

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

