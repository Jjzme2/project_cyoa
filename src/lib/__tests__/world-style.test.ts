import { describe, it, expect } from 'vitest'
import { selectProseStyle, worldStyleBlock } from '@/lib/ai/world-style'

describe('selectProseStyle', () => {
  it('returns null for an empty/absent pool', () => {
    expect(selectProseStyle(undefined, 0)).toBeNull()
    expect(selectProseStyle([], 3)).toBeNull()
    expect(selectProseStyle(['   '], 0)).toBeNull()
  })

  it('rotates deterministically through the pool by chapter index', () => {
    const pool = ['lyrical', 'spare', 'ornate']
    expect(selectProseStyle(pool, 0)).toBe('lyrical')
    expect(selectProseStyle(pool, 1)).toBe('spare')
    expect(selectProseStyle(pool, 2)).toBe('ornate')
    expect(selectProseStyle(pool, 3)).toBe('lyrical') // wraps
  })
})

describe('worldStyleBlock', () => {
  it('is empty when there are no settings', () => {
    expect(worldStyleBlock(undefined, 0)).toBe('')
    expect(worldStyleBlock({}, 0)).toBe('')
  })

  it('injects the mandate, the selected prose style, and motifs', () => {
    const out = worldStyleBlock(
      { mandate: 'Every chapter must contain poetic prose', proseStyles: ['lyrical', 'spare'], motifs: ['water', 'mirrors'] },
      1,
    )
    expect(out).toContain('MANDATE')
    expect(out).toContain('Every chapter must contain poetic prose')
    expect(out).toContain('PROSE STYLE for this chapter: spare') // index 1
    expect(out).toContain('water; mirrors')
  })

  it('injects per-story style choices as binding directives', () => {
    const out = worldStyleBlock(undefined, 0, { 'Rhyme scheme': 'ABBA', Meter: 'iambic pentameter' })
    expect(out).toContain('Rhyme scheme: ABBA — apply this consistently')
    expect(out).toContain('Meter: iambic pentameter')
  })

  it('renders style choices even with no world settings, and ignores blanks', () => {
    expect(worldStyleBlock(undefined, 0, { '': 'x', Foo: '  ' })).toBe('')
    expect(worldStyleBlock(undefined, 0, { Foo: 'Bar' })).toContain('Foo: Bar')
  })
})
