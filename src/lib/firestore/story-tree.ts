import { adminDb } from '../firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'
import type { StoryTreeNode } from '@/types'

// ─── Story Tree (for dashboard) ───────────────────────────────────────────────

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
