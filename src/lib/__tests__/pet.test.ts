import { describe, it, expect } from 'vitest'
import { stageFor, achievementsToNextStage, speciesPreviewEmoji, moodFor, quipFor, PET_SPECIES } from '@/lib/pet'

describe('Reader Pal — stages', () => {
  it('starts at level 1 with zero achievements, for every species', () => {
    for (const s of PET_SPECIES) {
      expect(stageFor(s.id, 0).level).toBe(1)
    }
  })

  it('levels up as achievements cross each threshold', () => {
    expect(stageFor('bird', 2).level).toBe(1)
    expect(stageFor('bird', 3).level).toBe(2)
    expect(stageFor('bird', 6).level).toBe(3)
    expect(stageFor('bird', 10).level).toBe(4)
    expect(stageFor('bird', 15).level).toBe(5)
    expect(stageFor('bird', 999).level).toBe(5) // caps at the last stage
  })

  it('every species levels on the identical achievement thresholds', () => {
    for (const count of [0, 3, 6, 10, 15]) {
      const levels = PET_SPECIES.map((s) => stageFor(s.id, count).level)
      expect(new Set(levels).size).toBe(1)
    }
  })

  it('reports how many achievements remain to the next stage, 0 at the cap', () => {
    expect(achievementsToNextStage('bird', 0)).toBe(3)
    expect(achievementsToNextStage('bird', 2)).toBe(1)
    expect(achievementsToNextStage('bird', 15)).toBe(0)
    expect(achievementsToNextStage('bird', 999)).toBe(0)
  })

  it('every species has a distinct, non-empty preview emoji', () => {
    const emojis = PET_SPECIES.map((s) => speciesPreviewEmoji(s.id))
    for (const e of emojis) expect(e.length).toBeGreaterThan(0)
  })
})

describe('Reader Pal — mood and quips', () => {
  it('is idle with no activity timestamp', () => {
    expect(moodFor(undefined)).toBe('idle')
  })

  it('is active within 3 days, idle beyond it', () => {
    const now = Date.now()
    expect(moodFor(new Date(now - 1 * 86_400_000).toISOString())).toBe('active')
    expect(moodFor(new Date(now - 10 * 86_400_000).toISOString())).toBe('idle')
  })

  it('quips are deterministic for a given mood + day seed', () => {
    expect(quipFor('active', 5)).toBe(quipFor('active', 5))
    expect(quipFor('idle', 5)).not.toBe(quipFor('active', 5))
  })
})
