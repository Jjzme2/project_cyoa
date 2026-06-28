import { describe, it, expect } from 'vitest'
import { formatCast } from '@/lib/ai/context-budget'
import type { StoryCharacter } from '@/types'

const char = (name: string, status = 'alive', description = 'a person'): StoryCharacter =>
  ({ name, status, description } as StoryCharacter)

describe('formatCast', () => {
  it('returns empty string when there is nothing to describe', () => {
    expect(formatCast(undefined, [])).toBe('')
    expect(formatCast(undefined, undefined)).toBe('')
  })

  it('includes the protagonist line when present', () => {
    const out = formatCast({ name: 'Elara', description: 'a cautious thief' }, [])
    expect(out).toContain('PROTAGONIST')
    expect(out).toContain('Elara — a cautious thief')
  })

  it('formats characters as compact key:value with status only when not alive', () => {
    const out = formatCast(undefined, [char('Bran', 'alive', 'a blacksmith'), char('Marcus', 'deceased', 'the fallen king')])
    expect(out).toContain('Bran=a blacksmith') // alive → no status tag
    expect(out).toContain('Marcus(deceased)=the fallen king')
  })

  it('orders living characters before the dead', () => {
    const out = formatCast(undefined, [char('Marcus', 'deceased'), char('Bran', 'alive')])
    expect(out.indexOf('Bran')).toBeLessThan(out.indexOf('Marcus'))
  })

  it('keeps everyone in awareness: overflow names listed when the detail budget is tight', () => {
    const many = Array.from({ length: 30 }, (_, i) => char(`Hero${i}`, 'alive', 'a long-winded description '.repeat(4)))
    const out = formatCast(undefined, many, { detailBudget: 300 })
    expect(out).toContain('Also present')
    // Every character name still appears somewhere (detailed or overflow).
    for (let i = 0; i < 30; i++) expect(out).toContain(`Hero${i}`)
  })

  it('clips overly long descriptions', () => {
    const out = formatCast(undefined, [char('Vey', 'alive', 'x'.repeat(500))], { descMax: 40 })
    expect(out).toContain('…')
    expect(out.length).toBeLessThan(200)
  })
})
