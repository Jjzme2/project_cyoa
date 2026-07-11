import { describe, it, expect } from 'vitest'
import { parseAIResponse } from '@/lib/ai/shared'
import { formatCast } from '@/lib/ai/context-budget'

const CHAPTER = `The bell cracked at dawn.

CHOICE_1: Follow the sexton into the crypt
CHOICE_2: Question the silent bellringer
CHOICE_3: Leave before the crowd gathers
`

describe('NEW_CHARACTER depth parsing', () => {
  it('parses wants and voice segments alongside the description', () => {
    const text = `${CHAPTER}
NEW_CHARACTER: Mother Iven — the parish's blind sexton — wants: to bury a secret with the old bell — voice: short sentences, scripture half-quoted`
    const { newCharacters } = parseAIResponse(text)
    expect(newCharacters).toEqual([
      {
        name: 'Mother Iven',
        description: "the parish's blind sexton",
        status: 'alive',
        want: 'to bury a secret with the old bell',
        voice: 'short sentences, scripture half-quoted',
      },
    ])
  })

  it('still parses the old plain format (no depth segments)', () => {
    const text = `${CHAPTER}\nNEW_CHARACTER: Brann — a nervous ferryman`
    const { newCharacters } = parseAIResponse(text)
    expect(newCharacters).toEqual([{ name: 'Brann', description: 'a nervous ferryman', status: 'alive' }])
  })
})

describe('CHARACTER_UPDATE parsing', () => {
  it('parses status and evolution note, stripping the line from content', () => {
    const text = `${CHAPTER}\nCHARACTER_UPDATE: Brann — status: deceased — now: drowned holding the rope he refused to cut`
    const parsed = parseAIResponse(text)
    expect(parsed.characterUpdates).toEqual([
      { name: 'Brann', status: 'deceased', note: 'drowned holding the rope he refused to cut' },
    ])
    expect(parsed.content).not.toContain('CHARACTER_UPDATE')
  })

  it('accepts a note-only update (growth without a status change)', () => {
    const text = `${CHAPTER}\nCHARACTER_UPDATE: Mother Iven — now: no longer trusts the protagonist with the crypt key`
    const { characterUpdates } = parseAIResponse(text)
    expect(characterUpdates).toEqual([
      { name: 'Mother Iven', status: undefined, note: 'no longer trusts the protagonist with the crypt key' },
    ])
  })

  it('ignores an update with a name but neither status nor note', () => {
    const text = `${CHAPTER}\nCHARACTER_UPDATE: Mother Iven`
    expect(parseAIResponse(text).characterUpdates).toEqual([])
  })

  it('returns an empty array when no updates are present', () => {
    expect(parseAIResponse(CHAPTER).characterUpdates).toEqual([])
  })
})

describe('formatCast depth rendering', () => {
  it('renders wants/voice/arc compactly next to the description', () => {
    const out = formatCast(undefined, [
      {
        name: 'Mother Iven',
        description: 'the blind sexton',
        status: 'alive',
        want: 'to bury a secret',
        voice: 'scripture half-quoted',
        arc: 'no longer trusts the protagonist',
      },
    ])
    expect(out).toContain('Mother Iven=the blind sexton [wants: to bury a secret; voice: scripture half-quoted; now: no longer trusts the protagonist]')
  })

  it('renders plain entries unchanged when no depth fields exist', () => {
    const out = formatCast(undefined, [{ name: 'Brann', description: 'a ferryman', status: 'alive' }])
    expect(out).toContain('Brann=a ferryman')
    expect(out).not.toContain('[')
  })

  it('keeps non-alive statuses visible with depth fields', () => {
    const out = formatCast(undefined, [{ name: 'Brann', description: 'a ferryman', status: 'deceased', arc: 'drowned at the crossing' }])
    expect(out).toContain('Brann(deceased)=a ferryman [now: drowned at the crossing]')
  })
})
