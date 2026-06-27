import { vi, describe, it, expect, beforeEach } from 'vitest'

// In-memory Firestore + controllable rate-limit fakes. `vi.hoisted` exposes the
// handles to the hoisted vi.mock factories without tripping the out-of-scope rule.
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  const snap = (id: string) => ({ exists: store.has(id), data: () => store.get(id) })

  const applySet = (id: string, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
    const prev = opts?.merge ? (store.get(id) ?? {}) : {}
    const next: Record<string, unknown> = { ...prev }
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && '__increment' in (v as Record<string, unknown>)) {
        next[k] = ((prev[k] as number) ?? 0) + (v as { __increment: number }).__increment
      } else {
        next[k] = v
      }
    }
    store.set(id, next)
  }

  const docRef = (id: string) => ({
    id,
    get: async () => snap(id),
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => applySet(id, data, opts),
  })

  const adminDb = {
    collection: () => ({ doc: (id: string) => docRef(id) }),
    runTransaction: async (fn: (txn: unknown) => Promise<void>) => {
      const txn = {
        get: async (ref: { id: string }) => snap(ref.id),
        set: (ref: { id: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) =>
          applySet(ref.id, data, opts),
      }
      return fn(txn)
    },
  }

  return {
    store,
    adminDb,
    checkRateLimit: vi.fn(),
    refundRateLimit: vi.fn(),
    getRemainingUses: vi.fn(),
  }
})

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }) },
}))
vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: h.checkRateLimit,
  refundRateLimit: h.refundRateLimit,
  getRemainingUses: h.getRemainingUses,
}))

import { CreditManager } from '@/lib/credit-manager'

beforeEach(() => {
  h.store.clear()
  h.checkRateLimit.mockReset()
  h.refundRateLimit.mockReset()
  h.getRemainingUses.mockReset()
  h.refundRateLimit.mockResolvedValue(undefined)
})

describe('CreditManager.consume', () => {
  it('consumes from the daily allowance first and does not touch purchased credits', async () => {
    h.checkRateLimit.mockResolvedValue({ success: true, remaining: 9, reset: 12345 })
    h.store.set('u1', { purchasedCredits: 5 })

    const r = await CreditManager.consume('u1', 'FREE', 1)

    expect(r).toMatchObject({ success: true, source: 'daily', remaining: 9, reset: 12345 })
    expect(h.refundRateLimit).not.toHaveBeenCalled()
    expect(h.store.get('u1')!.purchasedCredits).toBe(5)
  })

  it('falls back to purchased credits when the daily allowance is exhausted', async () => {
    h.checkRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: 111 })
    h.store.set('u2', { purchasedCredits: 5 })

    const r = await CreditManager.consume('u2', 'PREMIUM', 2)

    expect(r).toMatchObject({ success: true, source: 'purchased', remaining: 3, reset: 111 })
    expect(h.store.get('u2')!.purchasedCredits).toBe(3)
    // Daily count is refunded since we didn't spend a daily use.
    expect(h.refundRateLimit).toHaveBeenCalledWith('u2', 'PREMIUM', 2)
  })

  it('denies (without degraded) when daily is exhausted and purchased credits fall short', async () => {
    h.checkRateLimit.mockResolvedValue({ success: false, remaining: 0, reset: 222 })
    h.store.set('u3', { purchasedCredits: 1 })

    const r = await CreditManager.consume('u3', 'FREE', 5)

    expect(r.success).toBe(false)
    expect(r.degraded).toBe(false)
    expect(r.reset).toBe(222)
    expect(h.store.get('u3')!.purchasedCredits).toBe(1) // untouched
  })

  it('when the limiter is degraded, paying users keep working via purchased credits', async () => {
    h.checkRateLimit.mockResolvedValue({ success: false, degraded: true, remaining: 0, reset: 333 })
    h.store.set('u4', { purchasedCredits: 10 })

    const r = await CreditManager.consume('u4', 'PREMIUM', 4)

    expect(r).toMatchObject({ success: true, source: 'purchased', remaining: 6 })
    expect(h.store.get('u4')!.purchasedCredits).toBe(6)
  })

  it('when the limiter is degraded and there are no purchased credits, denies and flags degraded', async () => {
    h.checkRateLimit.mockResolvedValue({ success: false, degraded: true, remaining: 0, reset: 444 })

    const r = await CreditManager.consume('u5', 'FREE', 1)

    expect(r).toMatchObject({ success: false, degraded: true, remaining: 0, reset: 444 })
  })
})

describe('CreditManager.getCreditsInfo', () => {
  it('combines daily remaining with the purchased balance', async () => {
    h.getRemainingUses.mockResolvedValue({ remaining: 8, limit: 10, reset: 555 })
    h.store.set('u6', { purchasedCredits: 20 })

    const info = await CreditManager.getCreditsInfo('u6', 'PREMIUM')

    expect(info).toEqual({
      dailyRemaining: 8,
      dailyLimit: 10,
      purchasedCredits: 20,
      totalRemaining: 28,
      reset: 555,
    })
  })

  it('treats a missing settings doc as zero purchased credits', async () => {
    h.getRemainingUses.mockResolvedValue({ remaining: 3, limit: 10, reset: 1 })

    const info = await CreditManager.getCreditsInfo('nobody', 'FREE')

    expect(info.purchasedCredits).toBe(0)
    expect(info.totalRemaining).toBe(3)
  })
})

describe('CreditManager.addCredits', () => {
  it('increments both the balance and the lifetime-purchased total', async () => {
    await CreditManager.addCredits('u7', 50)
    expect(h.store.get('u7')).toMatchObject({ purchasedCredits: 50, lifetimeCreditsPurchased: 50 })

    await CreditManager.addCredits('u7', 25)
    expect(h.store.get('u7')).toMatchObject({ purchasedCredits: 75, lifetimeCreditsPurchased: 75 })
  })
})

describe('CreditManager.setPurchasedCredits', () => {
  it('sets an exact, floored balance and returns it', async () => {
    const next = await CreditManager.setPurchasedCredits('u8', 12.7)
    expect(next).toBe(12)
    expect(h.store.get('u8')!.purchasedCredits).toBe(12)
  })

  it('floors negative inputs to zero', async () => {
    const next = await CreditManager.setPurchasedCredits('u8', -5)
    expect(next).toBe(0)
    expect(h.store.get('u8')!.purchasedCredits).toBe(0)
  })
})

describe('CreditManager.grantCredits', () => {
  it('grants credits without counting them as a lifetime purchase', async () => {
    await CreditManager.grantCredits('u9', 30)
    expect(h.store.get('u9')!.purchasedCredits).toBe(30)
    expect(h.store.get('u9')!.lifetimeCreditsPurchased).toBeUndefined()
  })

  it('is a no-op for non-positive amounts', async () => {
    await CreditManager.grantCredits('u9', 0)
    await CreditManager.grantCredits('u9', -10)
    expect(h.store.has('u9')).toBe(false)
  })
})

describe('CreditManager.holdPurchased', () => {
  it('escrows credits when the balance is sufficient', async () => {
    h.store.set('u10', { purchasedCredits: 100 })
    const ok = await CreditManager.holdPurchased('u10', 40)
    expect(ok).toBe(true)
    expect(h.store.get('u10')!.purchasedCredits).toBe(60)
  })

  it('refuses and leaves the balance untouched when funds fall short', async () => {
    h.store.set('u10', { purchasedCredits: 60 })
    const ok = await CreditManager.holdPurchased('u10', 1000)
    expect(ok).toBe(false)
    expect(h.store.get('u10')!.purchasedCredits).toBe(60)
  })

  it('refuses non-positive holds', async () => {
    expect(await CreditManager.holdPurchased('u10', 0)).toBe(false)
  })
})

describe('CreditManager.refund', () => {
  it('refunds purchased credits back to the Firestore balance', async () => {
    await CreditManager.refund('u11', 'FREE', 5, 'purchased')
    expect(h.store.get('u11')!.purchasedCredits).toBe(5)
  })

  it('refunds daily credits back to the rate limiter', async () => {
    await CreditManager.refund('u12', 'FREE', 3, 'daily')
    expect(h.refundRateLimit).toHaveBeenCalledWith('u12', 'FREE', 3)
    expect(h.store.has('u12')).toBe(false)
  })
})
