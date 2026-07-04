import { describe, it, expect, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth'

vi.mock('@/lib/firebase-admin', () => ({ adminAuth: {} }))

const { requireRegisteredAccount } = await import('@/lib/auth')

function makeAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    uid: 'u1',
    email: null,
    name: null,
    tier: 'FREE',
    role: 'user',
    isAdmin: false,
    dob: null,
    age: null,
    allowedRank: 0,
    twofaVerifiedAt: null,
    isAnonymous: false,
    ...overrides,
  }
}

describe('requireRegisteredAccount', () => {
  it('blocks a guest (anonymous) account', () => {
    expect(requireRegisteredAccount(makeAuth({ isAnonymous: true }))).toBe(
      'Create a free account to use AI features.',
    )
  })

  it('allows a registered account', () => {
    expect(requireRegisteredAccount(makeAuth({ isAnonymous: false }))).toBeNull()
  })
})
