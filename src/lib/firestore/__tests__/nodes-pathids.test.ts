import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * pathIds denormalization: createStoryNode should compute a full ancestor
 * chain at creation time, and getStoryPath should batch-fetch ancestors from
 * that chain instead of walking parentId one read at a time — while still
 * falling back to the walk for nodes that predate the field.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()
  let autoId = 0

  function docRef(path: string): Record<string, unknown> {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path) }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        store.set(path, opts?.merge ? { ...(store.get(path) ?? {}), ...data } : data)
      },
      update: async (data: Record<string, unknown>) => {
        store.set(path, { ...(store.get(path) ?? {}), ...data })
      },
      collection: (name: string) => collectionRef(`${path}/${name}`),
    }
  }

  function collectionRef(path: string): Record<string, unknown> {
    return {
      doc: (id?: string) => docRef(`${path}/${id ?? `auto-${autoId++}`}`),
    }
  }

  const adminDb = {
    collection: (name: string) => collectionRef(name),
    batch: () => {
      const ops: Array<() => void> = []
      return {
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          ops.push(() => store.set(ref.path, data))
        },
        commit: async () => {
          ops.forEach((op) => op())
        },
      }
    },
  }

  return { store, adminDb }
})

vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))

import { createStoryNode, getStoryPath } from '@/lib/firestore/nodes'

beforeEach(() => {
  h.store.clear()
})

describe('createStoryNode pathIds', () => {
  it('leaves pathIds unset for a root node (no parentId)', async () => {
    const id = await createStoryNode({
      storyId: 's1',
      content: 'root',
      depth: 0,
      parentId: null,
      choiceText: null,
      authorId: 'u1',
      aiGenerated: false,
      aiModel: null,
      imageUrl: null,
    } as never)

    expect(h.store.get(`stories/s1/nodes/${id}`)?.pathIds).toBeUndefined()
  })

  it('computes pathIds as [parentId] for a child of a root node', async () => {
    const rootId = await createStoryNode({
      storyId: 's1', content: 'root', depth: 0, parentId: null, choiceText: null,
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)
    const childId = await createStoryNode({
      storyId: 's1', content: 'child', depth: 1, parentId: rootId, choiceText: 'go',
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)

    expect(h.store.get(`stories/s1/nodes/${childId}`)?.pathIds).toEqual([rootId])
  })

  it('appends to the parent chain for a grandchild', async () => {
    const rootId = await createStoryNode({
      storyId: 's1', content: 'root', depth: 0, parentId: null, choiceText: null,
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)
    const childId = await createStoryNode({
      storyId: 's1', content: 'child', depth: 1, parentId: rootId, choiceText: 'go',
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)
    const grandchildId = await createStoryNode({
      storyId: 's1', content: 'grandchild', depth: 2, parentId: childId, choiceText: 'go deeper',
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)

    expect(h.store.get(`stories/s1/nodes/${grandchildId}`)?.pathIds).toEqual([rootId, childId])
  })
})

describe('getStoryPath', () => {
  it('uses the pathIds fast path when present, root-first leaf-last', async () => {
    const rootId = await createStoryNode({
      storyId: 's1', content: 'root', depth: 0, parentId: null, choiceText: null,
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)
    const childId = await createStoryNode({
      storyId: 's1', content: 'child', depth: 1, parentId: rootId, choiceText: 'go',
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)
    const leafId = await createStoryNode({
      storyId: 's1', content: 'leaf', depth: 2, parentId: childId, choiceText: 'go deeper',
      authorId: 'u1', aiGenerated: false, aiModel: null, imageUrl: null,
    } as never)

    const path = await getStoryPath('s1', leafId)
    expect(path.map((s) => s.id)).toEqual([rootId, childId, leafId])
    expect(path.map((s) => s.content)).toEqual(['root', 'child', 'leaf'])
  })

  it('falls back to the parentId walk when pathIds is absent (legacy nodes)', async () => {
    h.store.set('stories/s1/nodes/root', { content: 'root', depth: 0, parentId: null, choiceText: null })
    h.store.set('stories/s1/nodes/child', { content: 'child', depth: 1, parentId: 'root', choiceText: 'go' })
    h.store.set('stories/s1/nodes/leaf', { content: 'leaf', depth: 2, parentId: 'child', choiceText: 'go deeper' })

    const path = await getStoryPath('s1', 'leaf')
    expect(path.map((s) => s.id)).toEqual(['root', 'child', 'leaf'])
  })

  it('returns an empty array for a missing node', async () => {
    const path = await getStoryPath('s1', 'nonexistent')
    expect(path).toEqual([])
  })
})
