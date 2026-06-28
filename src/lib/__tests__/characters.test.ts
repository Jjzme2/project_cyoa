import { describe, it, expect } from 'vitest'
import { slugifyName, characterId, monogram, appearanceSummary, isCrossWorld } from '@/lib/characters'

describe('slugifyName', () => {
  it('lowercases, dashes non-alphanumerics, and trims', () => {
    expect(slugifyName('  Lady Aria of the West! ')).toBe('lady-aria-of-the-west')
  })
  it('caps length', () => {
    expect(slugifyName('a'.repeat(100)).length).toBe(60)
  })
})

describe('characterId', () => {
  it('is deterministic and scoped — same author+name merges', () => {
    expect(characterId('author', 'u1', 'Aria')).toBe(characterId('author', 'u1', 'aria'))
  })
  it('keeps different owners distinct', () => {
    expect(characterId('author', 'u1', 'Aria')).not.toBe(characterId('author', 'u2', 'Aria'))
  })
  it('keeps different scopes distinct', () => {
    expect(characterId('author', 'x', 'Aria')).not.toBe(characterId('world', 'x', 'Aria'))
  })
})

describe('monogram', () => {
  it('uses first+last initials for multi-word names', () => {
    expect(monogram('Lady Aria')).toBe('LA')
  })
  it('uses the first two letters for single names', () => {
    expect(monogram('Aria')).toBe('AR')
  })
  it('handles blanks', () => {
    expect(monogram('   ')).toBe('?')
  })
})

describe('appearanceSummary', () => {
  it('singular story, single world', () => {
    expect(appearanceSummary({ storyCount: 1, worldIds: ['w1'] })).toBe('Appeared in 1 story')
  })
  it('plural stories, single world omits the world clause', () => {
    expect(appearanceSummary({ storyCount: 3, worldIds: ['w1'] })).toBe('Appeared in 3 stories')
  })
  it('counts worlds when cross-world', () => {
    expect(appearanceSummary({ storyCount: 5, worldIds: ['w1', 'w2'] })).toBe('Appeared in 5 stories across 2 worlds')
  })
})

describe('isCrossWorld', () => {
  it('is true only with more than one world', () => {
    expect(isCrossWorld({ worldIds: ['a'] })).toBe(false)
    expect(isCrossWorld({ worldIds: ['a', 'b'] })).toBe(true)
  })
})
