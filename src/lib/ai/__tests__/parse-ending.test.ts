import { describe, it, expect } from 'vitest'
import { parseAIResponse } from '@/lib/ai/shared'

describe('parseAIResponse — endings', () => {
  it('parses an ENDING line into title + type and drops choices', () => {
    const text = [
      'The crown is reforged, and the kingdom exhales.',
      'ENDING: The Crown Reforged | triumphant',
      'CHOICE_1: this should be ignored',
      'LOCATION: The Throne Room',
    ].join('\n')
    const out = parseAIResponse(text)
    expect(out.ending).toEqual({ title: 'The Crown Reforged', type: 'triumphant' })
    expect(out.choices).toEqual([]) // terminal — no onward choices
    expect(out.content).not.toContain('ENDING:')
    expect(out.location).toBe('The Throne Room')
  })

  it('coerces an unknown ending type to bittersweet and defaults a blank title', () => {
    const out = parseAIResponse('The end.\nENDING:  | whatever')
    expect(out.ending?.type).toBe('bittersweet')
    expect(out.ending?.title).toBe('The End')
  })

  it('leaves a normal chapter (no ENDING line) with its three choices', () => {
    const text = 'A fork in the road.\nCHOICE_1: Left\nCHOICE_2: Right\nCHOICE_3: Back'
    const out = parseAIResponse(text)
    expect(out.ending).toBeUndefined()
    expect(out.choices).toEqual(['Left', 'Right', 'Back'])
  })
})
