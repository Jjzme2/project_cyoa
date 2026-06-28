import { describe, it, expect } from 'vitest'
import { formatStoryPath } from '@/lib/ai/story-memory'
import type { StoryPathSegment } from '@/types'

const seg = (content: string, choiceText?: string): StoryPathSegment =>
  ({ content, choiceText } as StoryPathSegment)

describe('formatStoryPath', () => {
  it('returns a short story verbatim', () => {
    const path = [seg('Opening.'), seg('Second.', 'go left'), seg('Third.', 'open door')]
    const out = formatStoryPath(path)
    expect(out).toContain('Chapter 1 (Beginning):')
    expect(out).toContain('Opening.')
    expect(out).toContain('Third.')
    expect(out).not.toContain('STORY MEMORY')
  })

  it('compresses the middle of a long story while keeping opening + recent verbatim', () => {
    const path = [
      seg('THE OPENING ESTABLISHES EVERYTHING.'),
      ...Array.from({ length: 8 }, (_, i) => seg(`Middle chapter ${i + 2} body text.`, `choice ${i + 2}`)),
      seg('RECENT CHAPTER A.', 'recent choice A'),
      seg('RECENT CHAPTER B.', 'recent choice B'),
    ]
    const out = formatStoryPath(path, { recentFull: 2 })

    // Opening verbatim
    expect(out).toContain('THE OPENING ESTABLISHES EVERYTHING.')
    // Middle digested
    expect(out).toContain('STORY MEMORY')
    expect(out).toContain('Ch5:')
    expect(out).toContain('chose "choice 5"')
    // Recent two verbatim
    expect(out).toContain('RECENT CHAPTER A.')
    expect(out).toContain('RECENT CHAPTER B.')
  })

  it('bounds the output: a 30-chapter story is far smaller than the raw concatenation', () => {
    // Realistic chapter length (~1100 chars, the prompt's word limit).
    const path = Array.from({ length: 30 }, (_, i) =>
      seg('A fairly long chapter body sentence. '.repeat(30), i === 0 ? undefined : `choice ${i + 1}`),
    )
    const raw = path.map((p) => p.content).join('\n\n')
    const out = formatStoryPath(path)
    expect(out.length).toBeLessThan(raw.length / 2)
  })
})
