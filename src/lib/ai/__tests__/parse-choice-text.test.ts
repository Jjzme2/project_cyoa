import { describe, it, expect } from 'vitest'
import { parseAIResponse, PromptRejectedError } from '@/lib/ai/shared'

describe('parseAIResponse — CHOICE_TEXT (inline editor correction)', () => {
  it('extracts a corrected choice and strips the line from the content', () => {
    const text = [
      'CHOICE_TEXT: I walk into the room.',
      'The door creaks open.',
      'CHOICE_1: Look around',
      'CHOICE_2: Call out',
      'CHOICE_3: Leave',
    ].join('\n')
    const out = parseAIResponse(text)
    expect(out.correctedChoiceText).toBe('I walk into the room.')
    expect(out.content).not.toContain('CHOICE_TEXT:')
    expect(out.content).toContain('The door creaks open.')
  })

  it('is undefined when the model omits the line (callers fall back to the original)', () => {
    const out = parseAIResponse('A fork in the road.\nCHOICE_1: Left\nCHOICE_2: Right\nCHOICE_3: Back')
    expect(out.correctedChoiceText).toBeUndefined()
  })

  it('still throws PromptRejectedError for a REJECTED response, same as before the editor merge', () => {
    expect(() => parseAIResponse('REJECTED: this breaks the fourth wall')).toThrow(PromptRejectedError)
  })
})
