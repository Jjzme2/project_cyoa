import { describe, it, expect } from 'vitest'
import {
  PET_SPECIES,
  isSpeciesUnlocked,
  unlockedSpecies,
  bondXp,
  levelFor,
  xpProgress,
  LEVEL_XP,
  MAX_LEVEL,
  LIFE_STAGES,
  STAGE_LEVELS,
  PAL_ADOPTION_COST,
  stageFor,
  levelsToNextStage,
  speciesPreviewEmoji,
  moodFor,
  quipFor,
  quipForEvent,
  palStats,
} from '@/lib/pet'

describe('species & unlock gating', () => {
  it('offers six species: three free, three achievement-gated', () => {
    expect(PET_SPECIES).toHaveLength(6)
    expect(PET_SPECIES.filter((s) => !s.requires).map((s) => s.id)).toEqual(['bird', 'dragon', 'sprout'])
    expect(PET_SPECIES.filter((s) => s.requires).map((s) => s.id)).toEqual(['cat', 'wisp', 'leviathan'])
  })

  it('free species are always unlocked; gated ones need their achievement', () => {
    expect(isSpeciesUnlocked('bird', [])).toBe(true)
    expect(isSpeciesUnlocked('cat', [])).toBe(false)
    expect(isSpeciesUnlocked('cat', ['bookworm'])).toBe(true)
    expect(isSpeciesUnlocked('wisp', ['secret_keeper'])).toBe(true)
    expect(isSpeciesUnlocked('leviathan', ['chronicler'])).toBe(true)
  })

  it('unlockedSpecies lists exactly what the earned set qualifies for', () => {
    expect(unlockedSpecies([])).toEqual(['bird', 'dragon', 'sprout'])
    expect(unlockedSpecies(['bookworm', 'secret_keeper'])).toEqual(['bird', 'dragon', 'sprout', 'cat', 'wisp'])
  })
})

describe('bond XP & levels', () => {
  it('a brand-new reader is level 1 with zero XP', () => {
    const xp = bondXp(0, {})
    expect(xp).toBe(0)
    expect(levelFor(xp)).toBe(1)
  })

  it('weights everything the reader does', () => {
    expect(bondXp(2, {})).toBe(50) // achievements alone
    expect(bondXp(0, { storiesRead: 3 })).toBe(30)
    expect(bondXp(0, { contributions: 2, endingsReached: 1 })).toBe(28)
    expect(bondXp(0, { deepBonds: 1, pathMilestones: 1 })).toBe(35)
  })

  it('levels are monotonic in XP and cap at MAX_LEVEL', () => {
    let prev = 0
    for (let xp = 0; xp <= 3000; xp += 10) {
      const level = levelFor(xp)
      expect(level).toBeGreaterThanOrEqual(prev)
      prev = level
    }
    expect(levelFor(999_999)).toBe(MAX_LEVEL)
  })

  it('xpProgress reports exact boundaries', () => {
    expect(xpProgress(0)).toEqual({ level: 1, into: 0, needed: 30, total: 0 })
    expect(xpProgress(29).level).toBe(1)
    expect(xpProgress(30)).toEqual({ level: 2, into: 0, needed: 50, total: 30 })
    const max = xpProgress(LEVEL_XP[MAX_LEVEL - 1] + 100)
    expect(max.level).toBe(MAX_LEVEL)
    expect(max.needed).toBe(0) // nothing further to earn
  })

  it('a seasoned v1 reader (15 achievements + activity) lands mid-ladder, never demoted', () => {
    // v1's max stage needed 15 achievements; the same reader must feel upgraded.
    const xp = bondXp(15, { storiesRead: 10, contributions: 5, endingsReached: 3 })
    expect(levelFor(xp)).toBeGreaterThanOrEqual(5)
  })
})

describe('life stages', () => {
  it('every species walks the same universal arc, hatching into Baby', () => {
    expect(LIFE_STAGES).toEqual(['Egg', 'Baby', 'Juvenile', 'Adolescent', 'Adult', 'Elder', 'Legendary'])
    for (const s of PET_SPECIES) {
      expect(stageFor(s.id, 1).name).toBe('Egg')
      expect(stageFor(s.id, 2).name).toBe('Baby')
      expect(stageFor(s.id, MAX_LEVEL).name).toBe('Legendary')
    }
  })

  it('stages advance at levels 1, 2, 3, 5, 7, 9, 10', () => {
    expect(stageFor('bird', 1).name).toBe('Egg')
    expect(stageFor('bird', 2).name).toBe('Baby')
    expect(stageFor('bird', 3).name).toBe('Juvenile')
    expect(stageFor('bird', 4).name).toBe('Juvenile')
    expect(stageFor('bird', 5).name).toBe('Adolescent')
    expect(stageFor('bird', 7).name).toBe('Adult')
    expect(stageFor('bird', 9).name).toBe('Elder')
    expect(stageFor('bird', 10).name).toBe('Legendary')
  })

  it('every species has a distinct look at every life stage', () => {
    for (const s of PET_SPECIES) {
      const ladder = STAGE_LEVELS.map((l) => stageFor(s.id, l).emoji)
      expect(new Set(ladder).size).toBe(LIFE_STAGES.length)
    }
  })

  it('levelsToNextStage counts down to the next band and 0 at final form', () => {
    expect(levelsToNextStage('bird', 1)).toBe(1)
    expect(levelsToNextStage('bird', 2)).toBe(1)
    expect(levelsToNextStage('bird', 3)).toBe(2)
    expect(levelsToNextStage('bird', 9)).toBe(1)
    expect(levelsToNextStage('bird', 10)).toBe(0)
  })

  it('species are visually distinct in the picker (no all-identical eggs)', () => {
    const emojis = PET_SPECIES.map((s) => speciesPreviewEmoji(s.id))
    expect(new Set(emojis).size).toBe(emojis.length)
  })
})

describe('adoption pricing', () => {
  it('a new pal has a positive purchased-credit price', () => {
    expect(PAL_ADOPTION_COST).toBeGreaterThan(0)
  })
})

describe('moods', () => {
  const now = Date.now()
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()

  it('maps recency to the four moods', () => {
    expect(moodFor(undefined, now)).toBe('idle')
    expect(moodFor(daysAgo(0.5), now)).toBe('thrilled')
    expect(moodFor(daysAgo(2), now)).toBe('active')
    expect(moodFor(daysAgo(10), now)).toBe('idle')
    expect(moodFor(daysAgo(30), now)).toBe('dozing')
  })
})

describe('flavor lines', () => {
  it('daily quips are deterministic per mood and differ across moods', () => {
    expect(quipFor('active', 5)).toBe(quipFor('active', 5))
    expect(quipFor('thrilled', 5)).not.toBe(quipFor('dozing', 5))
  })

  it('event quips are deterministic and drawn from event-specific pools', () => {
    expect(quipForEvent('chapter', 7)).toBe(quipForEvent('chapter', 7))
    expect(quipForEvent('ending', 7)).not.toBe(quipForEvent('chapter', 7))
    expect(quipForEvent('levelup', 3)).toBe(quipForEvent('levelup', 3))
  })

  it('the companion has scared and pat reactions of its own', () => {
    expect(quipForEvent('scared', 2)).toBe(quipForEvent('scared', 2))
    expect(quipForEvent('pat', 2)).toBe(quipForEvent('pat', 2))
    expect(quipForEvent('scared', 2)).not.toBe(quipForEvent('pat', 2))
  })
})

describe('companion stats', () => {
  it('picks the display stats from the achievement counts, defaulting to 0', () => {
    expect(palStats({})).toEqual({ storiesRead: 0, pathsWritten: 0, endingsWitnessed: 0, deepBonds: 0 })
    expect(palStats({ storiesRead: 4, contributions: 2, endingsReached: 1, deepBonds: 3 })).toEqual({
      storiesRead: 4,
      pathsWritten: 2,
      endingsWitnessed: 1,
      deepBonds: 3,
    })
  })
})
