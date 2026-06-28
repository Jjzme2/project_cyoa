import { describe, it, expect } from 'vitest'
import { sanitizeStyleChoices } from '@/lib/story-style'
import type { WorldStyleOption } from '@/types'

const options: WorldStyleOption[] = [
  { label: 'Rhyme scheme', choices: ['ABAB', 'ABBA', 'Free verse'] },
  { label: 'Tense', choices: ['past', 'present'] },
]

describe('sanitizeStyleChoices', () => {
  it('returns null when there are no options or no choices', () => {
    expect(sanitizeStyleChoices(undefined, options)).toBeNull()
    expect(sanitizeStyleChoices({ Tense: 'past' }, undefined)).toBeNull()
    expect(sanitizeStyleChoices({ Tense: 'past' }, [])).toBeNull()
  })

  it('keeps only picks that match an offered choice', () => {
    expect(sanitizeStyleChoices({ 'Rhyme scheme': 'ABBA', Tense: 'present' }, options)).toEqual({
      'Rhyme scheme': 'ABBA',
      Tense: 'present',
    })
  })

  it('drops unknown labels and invalid values', () => {
    expect(sanitizeStyleChoices({ 'Rhyme scheme': 'XYZ', Bogus: 'x', Tense: 'past' }, options)).toEqual({
      Tense: 'past',
    })
  })

  it('returns null when nothing valid remains', () => {
    expect(sanitizeStyleChoices({ 'Rhyme scheme': 'nope' }, options)).toBeNull()
  })
})
