import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Path Pioneer anti-farm: the public `traversals` counter counts every read,
 * but the credit-bearing MILESTONE counter (`milestoneTraversals`) only moves
 * for a distinct, registered, non-author reader — deduped once per (reader,
 * slot) — so an author can't mint the reward by scripting traversals of their
 * own slot.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  const INCREMENT = Symbol('increment')
  function isIncrement(v: unknown): v is { [INCREMENT]: true; delta: number } {
    return !!v && typeof v === 'object' && INCREMENT in (v as object)
  }
  function applyWrite(path: string, data: Record<string, unknown>, merge: boolean) {
    const prev = merge ? (store.get(path) ?? {}) : {}
    const next: Record<string, unknown> = { ...prev }
    for (const [k, v] of Object.entries(data)) {
      next[k] = isIncrement(v) ? ((prev[k] as number) ?? 0) + v.delta : v
    }
    store.set(path, next)
  }

  function docRef(path: string): Record<string, unknown> {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => ({ id: path.split('/').pop(), exists: store.has(path), data: () => store.get(path) }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => applyWrite(path, data, !!opts?.merge),
      update: async (data: Record<string, unknown>) => applyWrite(path, data, true),
      collection: (name: string) => collectionRef(`${path}/${name}`),
    }
  }
  function collectionRef(path: string): Record<string, unknown> {
    return { doc: (id: string) => docRef(`${path}/${id}`) }
  }

  const adminDb = {
    collection: (name: string) => collectionRef(name),
    runTransaction: async <T>(fn: (txn: unknown) => Promise<T>): Promise<T> => {
      const txn = {
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        update: (ref: { path: string }, data: Record<string, unknown>) => applyWrite(ref.path, data, true),
        set: (ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) =>
          applyWrite(ref.path, data, !!opts?.merge),
      }
      return fn(txn)
    },
  }
  return { store, adminDb, INCREMENT }
})

vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (delta: number) => ({ [h.INCREMENT]: true, delta }) },
}))
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))

import { incrementTraversal } from '@/lib/firestore/stories'

const SLOT = 'stories/s1/nodes/n1/slots/slot1'
const CHILD = 'stories/s1/nodes/child1'

beforeEach(() => {
  h.store.clear()
  h.store.set(SLOT, { submittedBy: 'author1', traversals: 0 })
  h.store.set(CHILD, { traversals: 0 })
})

describe('incrementTraversal — Path Pioneer milestone', () => {
  it('anonymous reads bump popularity but never the milestone', async () => {
    const r1 = await incrementTraversal('s1', 'n1', 'slot1', 'child1', null)
    const r2 = await incrementTraversal('s1', 'n1', 'slot1', 'child1', undefined)
    expect(r1.slotTraversals).toBe(1)
    expect(r2.slotTraversals).toBe(2)
    expect(r1.milestoneTraversals).toBeNull()
    expect(r2.milestoneTraversals).toBeNull()
    expect(h.store.get(SLOT)?.milestoneTraversals).toBeUndefined()
  })

  it("the author's own traversals never move the milestone", async () => {
    const r = await incrementTraversal('s1', 'n1', 'slot1', 'child1', 'author1')
    expect(r.slotTraversals).toBe(1) // popularity still counts
    expect(r.milestoneTraversals).toBeNull()
    expect(h.store.get(SLOT)?.milestoneTraversals).toBeUndefined()
  })

  it('a registered non-author reader counts once, and repeats are deduped', async () => {
    const first = await incrementTraversal('s1', 'n1', 'slot1', 'child1', 'reader1')
    const again = await incrementTraversal('s1', 'n1', 'slot1', 'child1', 'reader1')
    expect(first.milestoneTraversals).toBe(1)
    expect(again.milestoneTraversals).toBe(1) // same reader, no double-count
    expect(h.store.get(SLOT)?.milestoneTraversals).toBe(1)
  })

  it('distinct registered readers each advance the milestone', async () => {
    const a = await incrementTraversal('s1', 'n1', 'slot1', 'child1', 'reader1')
    const b = await incrementTraversal('s1', 'n1', 'slot1', 'child1', 'reader2')
    const c = await incrementTraversal('s1', 'n1', 'slot1', 'child1', 'reader3')
    expect([a.milestoneTraversals, b.milestoneTraversals, c.milestoneTraversals]).toEqual([1, 2, 3])
  })

  it('scripting one account cannot reach the threshold (stays at 1)', async () => {
    let last: number | null = null
    for (let i = 0; i < 30; i++) {
      last = (await incrementTraversal('s1', 'n1', 'slot1', 'child1', 'reader1')).milestoneTraversals
    }
    expect(last).toBe(1)
    expect(h.store.get(SLOT)?.milestoneTraversals).toBe(1)
    expect(h.store.get(SLOT)?.traversals).toBe(30) // popularity still tallies each hit
  })
})
