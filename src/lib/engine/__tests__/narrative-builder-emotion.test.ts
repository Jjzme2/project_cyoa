import { describe, it, expect } from 'vitest'
import { NarrativeBuilder } from '@/lib/engine/narrative-builder'
import type { Story, World } from '@/types'
import type { EngineState } from '@/types/engine'

function makeStory(overrides: Record<string, unknown> = {}): Story {
  return {
    id: 'story_1',
    title: 'The Cracked Bell',
    characters: [
      { name: 'Mother Iven', description: 'the blind sexton', status: 'alive' },
      { name: 'Brann', description: 'a ferryman', status: 'deceased' },
    ],
    goapEnabled: false,
    ...overrides,
  } as unknown as Story
}

const world = {
  id: 'world_1',
  name: 'Vesper Parish',
  description: 'a fog-bound parish',
  lore: 'old bells, older debts',
  rules: '',
  tone: 'Gritty Noir',
  rating: 'Teen',
  seed: 7,
} as unknown as World

describe('emotional continuity without GOAP', () => {
  it('maintains relationship/demeanour state for non-GOAP stories', () => {
    const builder = new NarrativeBuilder(makeStory(), world)
    const { context, updatedEngineState } = builder.buildContext('root', 1, {}, undefined, 0, 0.9)
    // The living cast is tracked (state persists for the route's conduct
    // shifts to accumulate); the deceased are not.
    expect(updatedEngineState.relationships).toBeDefined()
    expect(Object.keys(updatedEngineState.relationships!.affinity)).toContain('Mother Iven')
    expect(Object.keys(updatedEngineState.relationships!.affinity)).not.toContain('Brann')
    // Summaries are wired into the context fields formatForPrompt renders.
    expect(typeof context.relationshipSummary).toBe('string')
    expect(typeof context.demeanour).toBe('string')
  })

  it('carries prior affinity forward across chapters', () => {
    const builder = new NarrativeBuilder(makeStory(), world)
    const first = builder.buildContext('root', 1, {}, undefined)
    // Simulate the route's per-chapter conduct shift (the Content Judge).
    first.updatedEngineState.relationships!.affinity['Mother Iven'] = 0.9
    const second = builder.buildContext('root/0', 2, {}, first.updatedEngineState)
    expect(second.updatedEngineState.relationships!.affinity['Mother Iven']).toBeGreaterThan(0.3)
    expect(second.context.relationshipSummary).toMatch(/warm/i)
  })

  it('leaves relationship state untouched when the story has no cast', () => {
    const builder = new NarrativeBuilder(makeStory({ characters: [] }), world)
    const { context, updatedEngineState } = builder.buildContext('root', 1, {})
    expect(updatedEngineState.relationships).toBeUndefined()
    expect(context.relationshipSummary).toBe('')
  })
})

describe('turning-point dilemma directive', () => {
  it('appends the TRUE DILEMMA instruction when the arc reaches its turning point', () => {
    const builder = new NarrativeBuilder(makeStory(), world)
    let engineState: EngineState | undefined
    const directives: string[] = []
    // Beats advance every 2 chapters; the turning point (beat index 2) is
    // reached within the first six turns of any 4-beat arc.
    for (let depth = 1; depth <= 6; depth++) {
      const result = builder.buildContext(`path/${depth}`, depth, {}, engineState)
      engineState = result.updatedEngineState
      directives.push(result.context.plotDirective)
    }
    expect(directives.some((d) => d.includes('TRUE DILEMMA'))).toBe(true)
    // And it is scoped to the turning point, not appended every turn.
    expect(directives.every((d) => d.includes('TRUE DILEMMA'))).toBe(false)
  })
})
