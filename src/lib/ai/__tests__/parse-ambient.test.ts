import { describe, it, expect } from 'vitest'
import { parseAIResponse } from '@/lib/ai/shared'

describe('parseAIResponse — scene ambient', () => {
  it('parses a recognized AMBIENT line and strips it from the content', () => {
    const text = [
      'Rain hammers the tin roof as she waits.',
      'CHOICE_1: Step outside',
      'CHOICE_2: Wait it out',
      'CHOICE_3: Call for help',
      'AMBIENT: rain',
    ].join('\n')
    const out = parseAIResponse(text)
    expect(out.sceneAmbient).toBe('rain')
    expect(out.content).not.toContain('AMBIENT:')
  })

  it('is case-insensitive', () => {
    expect(parseAIResponse('A calm night.\nAMBIENT: Stars').sceneAmbient).toBe('stars')
  })

  it('omits sceneAmbient entirely when there is no AMBIENT line', () => {
    expect(parseAIResponse('A fork in the road.\nCHOICE_1: Left').sceneAmbient).toBeUndefined()
  })

  it('drops an unrecognized or hallucinated value rather than passing it through', () => {
    expect(parseAIResponse('A quiet moment.\nAMBIENT: thunderstorm-with-hail').sceneAmbient).toBeUndefined()
    expect(parseAIResponse('A quiet moment.\nAMBIENT: none').sceneAmbient).toBeUndefined()
  })
})
