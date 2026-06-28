import { describe, it, expect } from 'vitest'
import { seasonPhase, isSeasonLive, featuredSeason, countdownLabel } from '@/lib/seasons'

const base = { startsAt: '2026-06-01T00:00:00.000Z', endsAt: '2026-06-30T00:00:00.000Z', published: true }
const mid = new Date('2026-06-15T00:00:00.000Z')

describe('seasonPhase', () => {
  it('is draft when unpublished, regardless of dates', () => {
    expect(seasonPhase({ ...base, published: false }, mid)).toBe('draft')
  })

  it('is upcoming / live / ended around its window', () => {
    expect(seasonPhase(base, new Date('2026-05-01T00:00:00.000Z'))).toBe('upcoming')
    expect(seasonPhase(base, mid)).toBe('live')
    expect(seasonPhase(base, new Date('2026-07-01T00:00:00.000Z'))).toBe('ended')
  })

  it('treats unparseable dates as draft (never accidentally live)', () => {
    expect(seasonPhase({ startsAt: 'nope', endsAt: 'nope', published: true }, mid)).toBe('draft')
  })
})

describe('isSeasonLive', () => {
  it('matches phase === live', () => {
    expect(isSeasonLive(base, mid)).toBe(true)
    expect(isSeasonLive({ ...base, published: false }, mid)).toBe(false)
  })
})

describe('featuredSeason', () => {
  it('returns null when nothing is live or upcoming', () => {
    expect(featuredSeason([{ ...base, published: false }], mid)).toBeNull()
    expect(featuredSeason([], mid)).toBeNull()
  })

  it('prefers the live season ending soonest', () => {
    const soon = { ...base, endsAt: '2026-06-20T00:00:00.000Z' }
    const later = { ...base, endsAt: '2026-06-28T00:00:00.000Z' }
    expect(featuredSeason([later, soon], mid)).toBe(soon)
  })

  it('falls back to the next upcoming when none are live', () => {
    const early = { startsAt: '2026-07-05T00:00:00.000Z', endsAt: '2026-07-10T00:00:00.000Z', published: true }
    const late = { startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-10T00:00:00.000Z', published: true }
    expect(featuredSeason([late, early], mid)).toBe(early)
  })
})

describe('countdownLabel', () => {
  it('counts down to the end while live', () => {
    expect(countdownLabel(base, new Date('2026-06-27T00:00:00.000Z'))).toBe('3d 0h left')
  })

  it('counts down to the start while upcoming', () => {
    const s = { startsAt: '2026-06-15T05:00:00.000Z', endsAt: '2026-06-30T00:00:00.000Z', published: true }
    expect(countdownLabel(s, new Date('2026-06-15T00:00:00.000Z'))).toBe('Starts in 5h 0m')
  })

  it('reads Ended / Draft outside the live window', () => {
    expect(countdownLabel(base, new Date('2026-07-02T00:00:00.000Z'))).toBe('Ended')
    expect(countdownLabel({ ...base, published: false }, mid)).toBe('Draft')
  })
})
