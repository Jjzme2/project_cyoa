import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Money-path integration tests: the REAL bounty module, credit manager, and
 * stripe-event claim run against a path-keyed in-memory Firestore fake
 * (nested collections, dot-path updates, increments, transactions) — so escrow
 * atomicity and idempotency are exercised end-to-end, not mocked away.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  const applyValues = (prev: Record<string, unknown>, data: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...prev }
    for (const [k, v] of Object.entries(data)) {
      const isIncrement = v && typeof v === 'object' && '__increment' in (v as Record<string, unknown>)
      const value = isIncrement ? (((prev[k] as number) ?? 0) + (v as { __increment: number }).__increment) : v
      if (k.includes('.')) {
        // Firestore dot-path update semantics (one level is enough here).
        const [head, ...rest] = k.split('.')
        const inner = { ...((next[head] as Record<string, unknown>) ?? {}) }
        inner[rest.join('.')] = value
        next[head] = inner
      } else {
        next[k] = value
      }
    }
    return next
  }

  function docRef(path: string): Record<string, unknown> {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        store.set(path, applyValues(opts?.merge ? (store.get(path) ?? {}) : {}, data))
      },
      update: async (data: Record<string, unknown>) => {
        if (!store.has(path)) throw new Error(`update on missing doc ${path}`)
        store.set(path, applyValues(store.get(path)!, data))
      },
      delete: async () => void store.delete(path),
      collection: (name: string) => collectionRef(`${path}/${name}`),
    }
  }

  function collectionRef(path: string) {
    return {
      doc: (id?: string) => docRef(`${path}/${id ?? `auto-${store.size}`}`),
      add: async (data: Record<string, unknown>) => {
        const ref = docRef(`${path}/auto-${store.size}`)
        await (ref.set as (d: Record<string, unknown>) => Promise<void>)(data)
        return ref
      },
    }
  }

  const adminDb = {
    collection: (name: string) => collectionRef(name),
    runTransaction: async <T>(fn: (txn: unknown) => Promise<T>): Promise<T> => {
      const txn = {
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        set: (ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          store.set(ref.path, applyValues(opts?.merge ? (store.get(ref.path) ?? {}) : {}, data))
        },
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          store.set(ref.path, applyValues(store.get(ref.path) ?? {}, data))
        },
      }
      return fn(txn)
    },
    batch: () => {
      const ops: Array<() => void> = []
      return {
        set: (ref: { path: string }, data: Record<string, unknown>) => ops.push(() => store.set(ref.path, applyValues({}, data))),
        update: (ref: { path: string }, data: Record<string, unknown>) =>
          ops.push(() => store.set(ref.path, applyValues(store.get(ref.path) ?? {}, data))),
        delete: (ref: { path: string }) => ops.push(() => store.delete(ref.path)),
        commit: async () => void ops.forEach((op) => op()),
      }
    },
  }

  return { store, adminDb }
})

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }) },
}))
vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  refundRateLimit: vi.fn(),
  getRemainingUses: vi.fn(),
}))
// Bounty settlement fires an (unawaited, best-effort) achievement check — keep
// these tests focused on escrow correctness, not achievement reward amounts.
vi.mock('@/lib/firestore/achievements', () => ({ checkAndAwardAchievements: vi.fn().mockResolvedValue([]) }))

import { postBounty, cancelBounty, settleBountyOnFill } from '@/lib/firestore/bounties'
import { claimStripeEvent } from '@/lib/stripe-events'

const SLOT = 'stories/s1/nodes/n1/slots/slot1'
const balanceOf = (uid: string) => (h.store.get(`userSettings/${uid}`)?.purchasedCredits as number) ?? 0
const slotBounty = () => (h.store.get(SLOT)?.bounty ?? null) as { status?: string; reward?: number } | null

beforeEach(() => {
  h.store.clear()
  // An empty, unfilled slot and a poster with 10 purchased credits.
  h.store.set(SLOT, { id: 'slot1', nodeId: 'n1', storyId: 's1', slotIndex: 0, filled: false, childNodeId: null })
  h.store.set('userSettings/poster', { purchasedCredits: 10 })
})

describe('bounty escrow — money never leaks', () => {
  it('posting holds the escrow from purchased credits', async () => {
    const res = await postBounty('s1', 'n1', 'slot1', { uid: 'poster', name: 'P' }, 4)
    expect(res.ok).toBe(true)
    expect(balanceOf('poster')).toBe(6)
    expect(slotBounty()?.status).toBe('open')
  })

  it('refuses a bounty the poster cannot afford (no partial hold)', async () => {
    const res = await postBounty('s1', 'n1', 'slot1', { uid: 'poster', name: 'P' }, 50)
    expect(res.ok).toBe(false)
    expect(balanceOf('poster')).toBe(10)
    expect(slotBounty()).toBeNull()
  })

  it('cancel refunds the poster atomically with the status change', async () => {
    await postBounty('s1', 'n1', 'slot1', { uid: 'poster', name: 'P' }, 4)
    const res = await cancelBounty('s1', 'n1', 'slot1', 'poster')
    expect(res.ok).toBe(true)
    expect(balanceOf('poster')).toBe(10)
    expect(slotBounty()?.status).toBe('refunded')
  })

  it('only the poster may cancel', async () => {
    await postBounty('s1', 'n1', 'slot1', { uid: 'poster', name: 'P' }, 4)
    const res = await cancelBounty('s1', 'n1', 'slot1', 'someone-else')
    expect(res.ok).toBe(false)
    expect(balanceOf('poster')).toBe(6) // escrow still held
    expect(slotBounty()?.status).toBe('open')
  })

  it('a published fill pays the filler; settling twice never double-pays', async () => {
    await postBounty('s1', 'n1', 'slot1', { uid: 'poster', name: 'P' }, 4)
    await settleBountyOnFill('s1', 'n1', 'slot1', 'filler', 'child1', true)
    expect(balanceOf('filler')).toBe(4)
    expect(slotBounty()?.status).toBe('paid')
    // Redundant settle (retry/race) is a no-op — status is no longer 'open'.
    await settleBountyOnFill('s1', 'n1', 'slot1', 'filler', 'child1', true)
    expect(balanceOf('filler')).toBe(4)
  })

  it('filling your own bounty refunds the escrow instead of paying', async () => {
    await postBounty('s1', 'n1', 'slot1', { uid: 'poster', name: 'P' }, 4)
    await settleBountyOnFill('s1', 'n1', 'slot1', 'poster', 'child1', true)
    expect(balanceOf('poster')).toBe(10)
    expect(slotBounty()?.status).toBe('refunded')
  })

  it('a flagged fill defers payment until approval (escrow stays held)', async () => {
    await postBounty('s1', 'n1', 'slot1', { uid: 'poster', name: 'P' }, 4)
    await settleBountyOnFill('s1', 'n1', 'slot1', 'filler', 'child1', false)
    expect(balanceOf('filler')).toBe(0)
    expect(slotBounty()?.status).toBe('open')
    expect((slotBounty() as { pendingClaimBy?: string })?.pendingClaimBy).toBe('filler')
  })
})

describe('stripe event idempotency — a redelivery can never double-credit', () => {
  it('claims an event exactly once', async () => {
    expect(await claimStripeEvent('evt_1', 'checkout.session.completed')).toBe(true)
    expect(await claimStripeEvent('evt_1', 'checkout.session.completed')).toBe(false)
    expect(await claimStripeEvent('evt_2', 'checkout.session.completed')).toBe(true)
  })
})
