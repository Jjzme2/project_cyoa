import { describe, it, expect } from 'vitest'
import {
  ratingRank,
  ageFromDob,
  allowedRankForAge,
  canView,
  clampRating,
  RATING_RANK,
} from '@/lib/ratings'

/** Build an ISO date `years`/`days` before today, for clock-independent assertions. */
function dobYearsAgo(years: number, extraDays = 0): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  d.setDate(d.getDate() + extraDays)
  return d.toISOString().slice(0, 10)
}

describe('ratingRank', () => {
  it('orders ratings by restrictiveness', () => {
    expect(ratingRank('Everyone')).toBe(0)
    expect(ratingRank('Teen')).toBe(1)
    expect(ratingRank('Mature')).toBe(2)
  })
  it('treats missing ratings as the least restrictive', () => {
    expect(ratingRank(undefined)).toBe(0)
    expect(ratingRank(null)).toBe(0)
  })
})

describe('ageFromDob', () => {
  it('returns null for missing or unparseable input', () => {
    expect(ageFromDob(null)).toBeNull()
    expect(ageFromDob(undefined)).toBeNull()
    expect(ageFromDob('not-a-date')).toBeNull()
  })
  it('computes whole years and respects birthdays not yet reached', () => {
    expect(ageFromDob(dobYearsAgo(20))).toBe(20)
    // One day before the 20th birthday → still 19.
    expect(ageFromDob(dobYearsAgo(20, 1))).toBe(19)
  })
})

describe('allowedRankForAge (age gating)', () => {
  it('grants Everyone-only when no DOB is on file', () => {
    expect(allowedRankForAge(null)).toBe(RATING_RANK.Everyone)
  })
  it('blocks under-13 with a sentinel rank below Everyone', () => {
    expect(allowedRankForAge(12)).toBe(-1)
  })
  it('grants Teen to 13–17 and Mature to 18+', () => {
    expect(allowedRankForAge(13)).toBe(RATING_RANK.Teen)
    expect(allowedRankForAge(17)).toBe(RATING_RANK.Teen)
    expect(allowedRankForAge(18)).toBe(RATING_RANK.Mature)
    expect(allowedRankForAge(40)).toBe(RATING_RANK.Mature)
  })
})

describe('canView', () => {
  it('permits content at or below the viewer allowance', () => {
    expect(canView('Teen', RATING_RANK.Teen)).toBe(true)
    expect(canView('Everyone', RATING_RANK.Teen)).toBe(true)
  })
  it('blocks content above the viewer allowance', () => {
    expect(canView('Mature', RATING_RANK.Teen)).toBe(false)
    expect(canView('Teen', -1)).toBe(false)
  })
})

describe('clampRating (containment)', () => {
  it('clamps a request down to the ceiling', () => {
    expect(clampRating('Mature', 'Teen')).toBe('Teen')
    expect(clampRating('Mature', 'Everyone')).toBe('Everyone')
  })
  it('leaves a request at or below the ceiling unchanged', () => {
    expect(clampRating('Teen', 'Mature')).toBe('Teen')
    expect(clampRating('Everyone', 'Everyone')).toBe('Everyone')
  })
})
