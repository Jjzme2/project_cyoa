import { describe, it, expect } from 'vitest'
import { accentFor, normalizeStats, rarityStat } from '@/lib/share-card-helpers'

describe('accentFor', () => {
  it('gives each kind a distinct colour, defaulting story to house gold', () => {
    expect(accentFor('character')).toBe('#c4b5fd')
    expect(accentFor('ending')).toBe('#6ee7b7')
    expect(accentFor('world')).toBe('#5eead4')
    expect(accentFor('story')).toBe('#f5d896')
  })
})

describe('normalizeStats', () => {
  it('returns [] for undefined', () => {
    expect(normalizeStats(undefined)).toEqual([])
  })

  it('drops chips with an empty value or label', () => {
    const out = normalizeStats([
      { value: '12', label: 'reads' },
      { value: '  ', label: 'hidden' },
      { value: '3', label: '   ' },
    ])
    expect(out).toEqual([{ value: '12', label: 'reads' }])
  })

  it('caps at three chips', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ value: `${i}`, label: 'x' }))
    expect(normalizeStats(many)).toHaveLength(3)
  })
})

describe('rarityStat', () => {
  it('is null when nobody has reached the ending', () => {
    expect(rarityStat(0, 100)).toBeNull()
    expect(rarityStat(undefined, 100)).toBeNull()
  })

  it('renders "N of M" when a total is known', () => {
    expect(rarityStat(1, 340)).toEqual({ value: '1 of 340', label: 'reached this ending' })
  })

  it('falls back to a plain count when the total is missing or smaller (stale)', () => {
    expect(rarityStat(5)).toEqual({ value: '5', label: 'readers reached it' })
    expect(rarityStat(5, 2)).toEqual({ value: '5', label: 'readers reached it' })
  })

  it('uses the singular for exactly one reader', () => {
    expect(rarityStat(1)).toEqual({ value: '1', label: 'reader reached it' })
  })
})
