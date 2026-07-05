import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Node reactions: per-type counts are a single `reactions` map on the node doc,
 * mutated with atomic per-field increments (`reactions.<type>` += ±1). Verifies
 * toggle-on/off semantics, that many reactors sum correctly, and that a legacy
 * map is read and incremented in place — with no shard fan-out on reads.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  const INCREMENT = Symbol('increment')
  function isIncrement(v: unknown): v is { [INCREMENT]: true; delta: number } {
    return !!v && typeof v === 'object' && INCREMENT in (v as object)
  }

  // Apply a write map, resolving `FieldValue.increment` sentinels and honoring
  // Firestore dot-path keys (`reactions.👏`) as nested field updates.
  function applyWrite(target: Record<string, unknown>, data: Record<string, unknown>) {
    for (const [k, v] of Object.entries(data)) {
      if (k.includes('.')) {
        const [head, ...rest] = k.split('.')
        const tail = rest.join('.')
        const nested = { ...((target[head] as Record<string, unknown>) ?? {}) }
        nested[tail] = isIncrement(v) ? ((nested[tail] as number) ?? 0) + v.delta : v
        target[head] = nested
      } else {
        target[k] = isIncrement(v) ? ((target[k] as number) ?? 0) + v.delta : v
      }
    }
  }

  function docRef(path: string): Record<string, unknown> {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        const merged: Record<string, unknown> = opts?.merge ? { ...(store.get(path) ?? {}) } : {}
        applyWrite(merged, data)
        store.set(path, merged)
      },
      update: async (data: Record<string, unknown>) => {
        const merged: Record<string, unknown> = { ...(store.get(path) ?? {}) }
        applyWrite(merged, data)
        store.set(path, merged)
      },
      collection: (name: string) => collectionRef(`${path}/${name}`),
    }
  }

  function collectionRef(path: string): Record<string, unknown> {
    return {
      doc: (id: string) => docRef(`${path}/${id}`),
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

  it('sums correctly across many distinct users', async () => {
    for (let i = 0; i < 25; i++) {
      await toggleNodeReaction(`user-${i}`, 's1', 'n1', '✨')
    }
    const result = await getNodeReactions(null, 's1', 'n1')
    expect(result.counts['✨']).toBe(25)
  })

  it('keeps the node reactions map in sync with the delta', async () => {
    await toggleNodeReaction('u1', 's1', 'n1', '👏')
    await toggleNodeReaction('u2', 's1', 'n1', '👏')
    expect((h.store.get('stories/s1/nodes/n1')?.reactions as Record<string, number>)['👏']).toBe(2)
    await toggleNodeReaction('u1', 's1', 'n1', '👏')
    expect((h.store.get('stories/s1/nodes/n1')?.reactions as Record<string, number>)['👏']).toBe(1)
  })

  it('reads and increments a pre-existing reactions map in place', async () => {
    h.store.set('stories/s1/nodes/n1', { content: 'hi', reactions: { '👏': 5 } })
    const result = await getNodeReactions(null, 's1', 'n1')
    expect(result.counts['👏']).toBe(5)

    await toggleNodeReaction('u1', 's1', 'n1', '👏')
    const after = await getNodeReactions(null, 's1', 'n1')
    expect(after.counts['👏']).toBe(6)
  })
})
