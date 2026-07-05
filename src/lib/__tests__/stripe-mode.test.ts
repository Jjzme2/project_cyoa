import { describe, it, expect } from 'vitest'
import { computeStripeMocked } from '@/lib/stripe-mode'

describe('computeStripeMocked — mock checkout is never active in production', () => {
  it('production + no key: NOT mocked (payments fail cleanly, never mint)', () => {
    expect(computeStripeMocked('production', undefined)).toBe(false)
    expect(computeStripeMocked('production', '')).toBe(false)
  })

  it('production + placeholder key: NOT mocked', () => {
    expect(computeStripeMocked('production', 'sk_live_placeholder')).toBe(false)
  })

  it('production + real key: NOT mocked (live Stripe)', () => {
    expect(computeStripeMocked('production', 'sk_live_abc123')).toBe(false)
  })

  it('development + no/placeholder key: mocked (local dev convenience)', () => {
    expect(computeStripeMocked('development', undefined)).toBe(true)
    expect(computeStripeMocked('development', 'sk_test_placeholder')).toBe(true)
  })

  it('development/test + real key: NOT mocked (talks to real Stripe test mode)', () => {
    expect(computeStripeMocked('development', 'sk_test_abc123')).toBe(false)
    expect(computeStripeMocked('test', 'sk_test_abc123')).toBe(false)
  })
})
