import { adminDb } from '../firebase-admin'

export function storyRef(storyId: string) {
  return adminDb.collection('stories').doc(storyId)
}

export function nodesRef(storyId: string) {
  return storyRef(storyId).collection('nodes')
}

export function nodeRef(storyId: string, nodeId: string) {
  return nodesRef(storyId).doc(nodeId)
}

export function slotsRef(storyId: string, nodeId: string) {
  return nodeRef(storyId, nodeId).collection('slots')
}

export function slotRef(storyId: string, nodeId: string, slotId: string) {
  return slotsRef(storyId, nodeId).doc(slotId)
}

/**
 * Marker doc proving one reader traversed one slot — dedupes the Path Pioneer
 * milestone so it counts distinct registered readers, not raw (farmable) hits.
 * Top-level with a composite id, mirroring the `userReactions` pattern.
 */
export function slotTraverserRef(storyId: string, nodeId: string, slotId: string, uid: string) {
  return adminDb.collection('slotTraversers').doc(`${uid}_${storyId}_${nodeId}_${slotId}`)
}
