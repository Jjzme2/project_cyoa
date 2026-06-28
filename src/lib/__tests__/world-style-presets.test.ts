import { describe, it, expect } from 'vitest'
import { applyBundle, CURATED_STYLE_BUNDLES, STYLE_OPTION_PRESETS } from '@/lib/world-style-presets'

describe('curated bundles data', () => {
  it('every bundle has a unique id and at least two options', () => {
    const ids = new Set<string>()
    for (const b of CURATED_STYLE_BUNDLES) {
      expect(ids.has(b.id)).toBe(false)
      ids.add(b.id)
      expect(b.options.length).toBeGreaterThanOrEqual(2)
      for (const o of b.options) {
        expect(o.label.trim()).not.toBe('')
        expect(o.choices.split(',').filter((c) => c.trim()).length).toBeGreaterThanOrEqual(1)
      }
    }
    expect(STYLE_OPTION_PRESETS.length).toBeGreaterThan(0)
  })
})

describe('applyBundle', () => {
  const bundle = {
    id: 'x',
    name: 'X',
    description: '',
    options: [
      { label: 'Tense', choices: 'Past tense, Present tense' },
      { label: 'Pacing', choices: 'Brisk, Slow-burn' },
    ],
  }

  it('appends bundle options to an empty list', () => {
    expect(applyBundle([], bundle)).toEqual(bundle.options)
  })

  it('replaces a same-label option in place and appends the rest', () => {
    const existing = [
      { label: 'Tense', choices: 'OLD' },
      { label: 'Humor', choices: 'Dry wit' },
    ]
    const out = applyBundle(existing, bundle)
    // Tense replaced in its original position, Humor preserved, Pacing appended.
    expect(out).toEqual([
      { label: 'Tense', choices: 'Past tense, Present tense' },
      { label: 'Humor', choices: 'Dry wit' },
      { label: 'Pacing', choices: 'Brisk, Slow-burn' },
    ])
  })

  it('matches labels case-insensitively', () => {
    const out = applyBundle([{ label: 'tense', choices: 'OLD' }], bundle)
    expect(out.filter((o) => o.label.toLowerCase() === 'tense')).toHaveLength(1)
  })
})
