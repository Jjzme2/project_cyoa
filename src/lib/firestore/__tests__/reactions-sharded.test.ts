import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Sharded reaction counters: toggles increment a random shard doc instead of
 * a read-modify-write on the node itself, so concurrent reactors never
 * contend on one document. Verifies toggle-on/off semantics, cross-shard
 * summation, and that legacy (pre-sharding) `reactions` maps still count.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  const INCREMENT = Symbol('increment')
  function isIncrement(v: unknown): v is { [INCREMENT]: true; delta: number } {
    return !!v && typeof v === 'object' && INCREMENT in (v as object)
  }

  function docRef(path: string): Record<string, unknown> {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        const prev = opts?.merge ? (store.get(path) ?? {}) : {}
        const merged: Record<string, unknown> = { ...prev }
        for (const [k, v] of Object.entries(data)) {
          merged[k] = isIncrement(v) ? ((prev[k] as number) ?? 0) + v.delta : v
        }
        store.set(path, merged)
      },
      update: async (data: Record<string, unknown>) => {
        const prev = store.get(path) ?? {}
        const merged: Record<string, unknown> = { ...prev }
        for (const [k, v] of Object.entries(data)) {
          merged[k] = isIncrement(v) ? ((prev[k] as number) ?? 0) + v.delta : v
        }
        store.set(path, merged)
      },
      collection: (name: string) => collectionRef(`${path}/${name}`),
    }
  }

  function collectionRef(path: string): Record<string, unknown> {
    return {
      doc: (id: string) => docRef(`${path}/${id}`),
      get: async () => {
        const docs = Array.from(store.entries())
          .filter(([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
          .map(([p, data]) => ({ id: p.split('/').pop(), data: () => data }))
        return { docs }
      },
    }
  }

  const adminDb = {
    collection: (name: string) => collectionRef(name),
    runTransaction: async <T>(fn: (txn: unknown) => Promise<T>): Promise<T> => {
      const txn = {
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data })
        },
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

import { toggleNodeReaction, getNodeReactions } from '@/lib/firestore/reactions'

beforeEach(() => {
  h.store.clear()
  h.store.set('stories/s1/nodes/n1', { content: 'hi' })
})

describe('toggleNodeReaction', () => {
  it('adds a reaction on first toggle', async () => {
    const result = await toggleNodeReaction('u1', 's1', 'n1', '👏')
    expect(result.userReactions).toEqual(['👏'])
    expect(result.counts['👏']).toBe(1)
  })

  it('removes the reaction on second toggle (toggle off)', async () => {
    await toggleNodeReaction('u1', 's1', 'n1', '👏')
    const result = await toggleNodeReaction('u1', 's1', 'n1', '👏')
    expect(result.userReactions).toEqual([])
    expect(result.counts['👏'] ?? 0).toBe(0)
  })

  it('sums correctly across many distinct users (spread across shards)', async () => {
    for (let i = 0; i < 25; i++) {
      await toggleNodeReaction(`user-${i}`, 's1', 'n1', '✨')
    }
    const result = await getNodeReactions(null, 's1', 'n1')
    expect(result.counts['✨']).toBe(25)
  })

  it('keeps totalReactions on the node doc in sync with the delta', async () => {
    await toggleNodeReaction('u1', 's1', 'n1', '👏')
    await toggleNodeReaction('u2', 's1', 'n1', '👏')
    expect(h.store.get('stories/s1/nodes/n1')?.totalReactions).toBe(2)
    await toggleNodeReaction('u1', 's1', 'n1', '👏')
    expect(h.store.get('stories/s1/nodes/n1')?.totalReactions).toBe(1)
  })

  it('folds in a legacy (pre-sharding) reactions map as a frozen baseline', async () => {
    h.store.set('stories/s1/nodes/n1', { content: 'hi', reactions: { '👏': 5 } })
    const result = await getNodeReactions(null, 's1', 'n1')
    expect(result.counts['👏']).toBe(5)

    await toggleNodeReaction('u1', 's1', 'n1', '👏')
    const after = await getNodeReactions(null, 's1', 'n1')
    expect(after.counts['👏']).toBe(6)
  })
})
