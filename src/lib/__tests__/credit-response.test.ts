import { describe, it, expect } from 'vitest'
import { creditFailureResponse } from '@/lib/credit-response'

describe('creditFailureResponse', () => {
  it('returns 503 with a temporary-outage message when degraded', async () => {
    const res = creditFailureResponse({ degraded: true, reset: Date.now() + 1000 })
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('30')
    const body = await res.json()
    expect(body.degraded).toBe(true)
    expect(body.error).toMatch(/temporarily unavailable/i)
  })

  it('returns 429 with the caller message for a real shortfall', async () => {
    const res = creditFailureResponse({ reset: Date.now() + 1000 }, { insufficientMessage: 'No credits left' })
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe('No credits left')
    expect(body.degraded).toBeUndefined()
  })

  it('merges extra fields into the body', async () => {
    const res = creditFailureResponse({ reset: 123 }, { extra: { remaining: 0 } })
    const body = await res.json()
    expect(body.remaining).toBe(0)
  })
})
