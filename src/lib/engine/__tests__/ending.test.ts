import { describe, it, expect } from 'vitest'
import { endingDirective, ENDING_MIN_DEPTH } from '@/lib/engine/ending'
import type { EngineState } from '@/types'

const state = (over: Partial<EngineState>): EngineState =>
  ({ worldState: {}, agentMemories: {}, factions: {}, economy: {} as never, turnCount: 0, ...over } as EngineState)

describe('endingDirective', () => {
  it('never invites an ending before the minimum depth', () => {
    expect(endingDirective(ENDING_MIN_DEPTH - 1, state({ plot: { arcId: 'a', beatIndex: 3, turnsOnBeat: 1 } }))).toBe('')
  })

  it('invites strongly when the plot has reached its resolution beat', () => {
    expect(endingDirective(6, state({ plot: { arcId: 'a', beatIndex: 3, turnsOnBeat: 1 } }))).toMatch(/resolution/i)
  })

  it('nudges when a path has run long', () => {
    expect(endingDirective(12, state({}))).toMatch(/run long/i)
  })

  it('invites a denouement when tension spiked and settled', () => {
    expect(endingDirective(6, state({ director: { tension: 0.1, turnsSinceSpike: 4 } }))).toMatch(/settled/i)
  })

  it('keeps going on a tense mid-story chapter', () => {
    expect(endingDirective(6, state({ director: { tension: 0.7, turnsSinceSpike: 0 }, plot: { arcId: 'a', beatIndex: 1, turnsOnBeat: 1 } }))).toBe('')
  })
})
