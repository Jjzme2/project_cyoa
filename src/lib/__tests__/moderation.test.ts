import { describe, it, expect } from 'vitest'
import { moderateText, moderationToNodeFields } from '@/lib/moderation'

describe('moderateText — absolute prohibitions', () => {
  it('refuses slurs at every rating', () => {
    expect(moderateText('you faggot', 'Mature').action).toBe('refuse')
    expect(moderateText('you faggot', 'Everyone').action).toBe('refuse')
  })
  it('refuses sexual content involving minors', () => {
    const r = moderateText('explicit sexual content with a child', 'Mature')
    expect(r.action).toBe('refuse')
    expect(r.categories).toContain('csae')
  })
})

describe('moderateText — rating-graded content', () => {
  it('allows clean prose', () => {
    expect(moderateText('She walked through the quiet garden.', 'Everyone').action).toBe('allow')
  })

  it('flags Teen-level violence in an Everyone story but allows it in Teen+', () => {
    expect(moderateText('he was killed', 'Everyone').action).toBe('flag')
    expect(moderateText('he was killed', 'Teen').action).toBe('allow')
    expect(moderateText('he was killed', 'Mature').action).toBe('allow')
  })

  it('refuses content two+ ranks above the story rating', () => {
    // Graphic violence (Mature) in an Everyone story is a 2-rank gap → refuse.
    expect(moderateText('scenes of torture', 'Everyone').action).toBe('refuse')
  })

  it('flags strong profanity that is one rank over the story rating', () => {
    // Strong profanity (Mature) in a Teen story is a 1-rank gap → flag.
    expect(moderateText('what the fuck', 'Teen').action).toBe('flag')
    expect(moderateText('what the fuck', 'Mature').action).toBe('allow')
  })

  it('flags review-always categories even at their allowed rating', () => {
    // Graphic violence is allowed at Mature but always held for review.
    expect(moderateText('scenes of torture', 'Mature').action).toBe('flag')
  })
})

describe('moderationToNodeFields', () => {
  it('keeps flagged content unpublished', () => {
    const fields = moderationToNodeFields({ action: 'flag', categories: ['violence'], reason: 'x' })
    expect(fields.published).toBe(false)
    expect(fields.moderation.status).toBe('flagged')
  })
  it('publishes allowed content as approved', () => {
    const fields = moderationToNodeFields({ action: 'allow', categories: [] })
    expect(fields.published).toBe(true)
    expect(fields.moderation.status).toBe('approved')
  })
})
