import { describe, it, expect } from 'vitest'
import {
  emptyDirector,
  isDirectorMeaningful,
  describeDirector,
  describeDirectorForCoverArt,
  sanitizeDirector,
  personaMatches,
} from '@/lib/director'

describe('emptyDirector / isDirectorMeaningful', () => {
  it('a fresh persona is centered and not meaningful', () => {
    const d = emptyDirector()
    expect(d.experimental).toBe(0)
    expect(d.vision).toBe('')
    expect(isDirectorMeaningful(d)).toBe(false)
  })
  it('becomes meaningful when an axis moves or a vision is written', () => {
    expect(isDirectorMeaningful({ ...emptyDirector(), darkness: 0.5 })).toBe(true)
    expect(isDirectorMeaningful({ ...emptyDirector(), vision: 'a tender tale' })).toBe(true)
  })
})

describe('describeDirector', () => {
  it('emits nothing for a neutral persona', () => {
    expect(describeDirector(emptyDirector())).toEqual([])
    expect(describeDirector(null)).toEqual([])
  })
  it('only emits a note once an axis passes the threshold', () => {
    expect(describeDirector({ ...emptyDirector(), experimental: 0.2 })).toEqual([])
    expect(describeDirector({ ...emptyDirector(), experimental: 0.9 }).length).toBe(1)
  })
  it('appends the stated vision as the final note', () => {
    const notes = describeDirector({ ...emptyDirector(), darkness: 1, vision: 'dread' })
    expect(notes.length).toBe(2)
    expect(notes[notes.length - 1]).toContain('dread')
  })
})

describe('describeDirectorForCoverArt', () => {
  it('emits nothing for a neutral persona', () => {
    expect(describeDirectorForCoverArt(emptyDirector())).toEqual([])
    expect(describeDirectorForCoverArt(null)).toEqual([])
  })
  it('only emits a note once an axis passes the threshold', () => {
    expect(describeDirectorForCoverArt({ ...emptyDirector(), darkness: 0.2 })).toEqual([])
    expect(describeDirectorForCoverArt({ ...emptyDirector(), darkness: 0.9 }).length).toBe(1)
  })
  it('appends the stated vision as the final note', () => {
    const notes = describeDirectorForCoverArt({ ...emptyDirector(), darkness: 1, vision: 'dread' })
    expect(notes.length).toBe(2)
    expect(notes[notes.length - 1]).toContain('dread')
  })
})

describe('sanitizeDirector', () => {
  it('clamps axes into [-1, 1] and trims the vision', () => {
    const d = sanitizeDirector({ experimental: 5, pace: -9, vision: '  hi  ' })
    expect(d?.experimental).toBe(1)
    expect(d?.pace).toBe(-1)
    expect(d?.vision).toBe('hi')
  })
  it('returns null for empty or non-object input', () => {
    expect(sanitizeDirector(null)).toBeNull()
    expect(sanitizeDirector('nope')).toBeNull()
    expect(sanitizeDirector({ experimental: 0, vision: '' })).toBeNull()
  })
})

describe('personaMatches', () => {
  it('matches within a small epsilon and distinguishes real differences', () => {
    const a = { ...emptyDirector(), darkness: 0.5 }
    expect(personaMatches(a, { ...emptyDirector(), darkness: 0.52 })).toBe(true)
    expect(personaMatches(a, { ...emptyDirector(), darkness: 0.9 })).toBe(false)
  })
})
