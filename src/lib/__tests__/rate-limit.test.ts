import { vi, describe, it, expect, beforeEach } from 'vitest'

// Controllable fake for @upstash/redis. `vi.hoisted` makes the handles available
// to the (hoisted) vi.mock factory without tripping the out-of-scope rule.
const h = vi.hoisted(() => ({
  incrby: vi.fn(),
  expire: vi.fn(),
  state: { throwOnConnect: false },
}))

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => {
      if (h.state.throwOnConnect) throw new Error('redis unavailable')
      return { incrby: h.incrby, expire: h.expire }
    },
  },
}))

import { checkRateLimit } from '@/lib/rate-limit'

beforeEach(() => {
  h.incrby.mockReset()
  h.expire.mockReset()
  h.state.throwOnConnect = false
})

describe('checkRateLimit', () => {
  it('succeeds within the daily allowance', async () => {
    h.incrby.mockResolvedValue(1)
    const r = await checkRateLimit('u', 'FREE', 1)
    expect(r.success).toBe(true)
    expect(r.degraded).toBeUndefined()
  })

  it('denies (without degraded) once the allowance is exceeded', async () => {
    h.incrby.mockResolvedValue(999)
    const r = await checkRateLimit('u', 'FREE', 1)
    expect(r.success).toBe(false)
    expect(r.degraded).toBeUndefined()
  })

  it('FAILS CLOSED and flags degraded when Redis is unreachable', async () => {
    h.state.throwOnConnect = true
    const r = await checkRateLimit('u', 'FREE', 1)
    expect(r.success).toBe(false)
    expect(r.degraded).toBe(true)
    expect(r.remaining).toBe(0)
  })
})
