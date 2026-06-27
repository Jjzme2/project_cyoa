import { describe, it, expect } from 'vitest'
import { userMatchesQuery } from '@/lib/admin-user-search'

const user = { uid: 'abc123', email: 'Jane.Doe@Example.com', displayName: 'Jane Doe' }

describe('userMatchesQuery', () => {
  it('matches everything for an empty/whitespace query', () => {
    expect(userMatchesQuery(user, '')).toBe(true)
    expect(userMatchesQuery(user, '   ')).toBe(true)
  })

  it('matches email case-insensitively, including substrings', () => {
    expect(userMatchesQuery(user, 'jane.doe@example.com')).toBe(true)
    expect(userMatchesQuery(user, 'EXAMPLE')).toBe(true)
  })

  it('matches substrings of display name and uid', () => {
    expect(userMatchesQuery(user, 'doe')).toBe(true)
    expect(userMatchesQuery(user, 'abc')).toBe(true)
  })

  it('returns false for unrelated text', () => {
    expect(userMatchesQuery(user, 'zzz')).toBe(false)
  })

  it('tolerates missing email / display name', () => {
    expect(userMatchesQuery({ uid: 'x1', email: null, displayName: null }, 'x1')).toBe(true)
    expect(userMatchesQuery({ uid: 'x1' }, 'nope')).toBe(false)
  })
})
