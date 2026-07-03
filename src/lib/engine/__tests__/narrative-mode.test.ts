import { describe, it, expect } from 'vitest'
import { resolveNarrativeMode, gentleModeDirective } from '@/lib/engine/narrative-mode'
import { PlotPlanner } from '@/lib/engine/plot-planner'
import { DramaManager } from '@/lib/engine/drama-manager'
import { DifficultyManager } from '@/lib/engine/difficulty'

const base = {
  tone: 'Epic Fantasy',
  rules: '• Magic has a price',
  lore: 'An old kingdom of storms.',
  description: 'A world of contested thrones.',
  rating: 'Teen' as const,
}

describe('resolveNarrativeMode', () => {
  it('defaults to dramatic for a typical world', () => {
    expect(resolveNarrativeMode(base)).toBe('dramatic')
  })

  it('an explicit author setting always wins', () => {
    expect(resolveNarrativeMode({ ...base, storySettings: { narrativeMode: 'gentle' } })).toBe('gentle')
    const gentleText = { ...base, rules: 'No bad happens here', storySettings: { narrativeMode: 'dramatic' as const } }
    expect(resolveNarrativeMode(gentleText)).toBe('dramatic')
  })

  it('a "no bad happens" declaration is decisive on its own', () => {
    expect(resolveNarrativeMode({ ...base, rules: '• No bad happens here, ever' })).toBe('gentle')
    expect(resolveNarrativeMode({ ...base, lore: 'Everyone is kind and everyone is safe.' })).toBe('gentle')
    expect(resolveNarrativeMode({ ...base, description: 'A violence-free meadow realm.' })).toBe('gentle')
  })

  it('soft signals need corroboration (Everyone rating + two keywords)', () => {
    const cozy = { ...base, rating: 'Everyone' as const, description: 'A cozy, wholesome village of soft mornings.' }
    expect(resolveNarrativeMode(cozy)).toBe('gentle')
    // One soft keyword alone, or a Teen rating, stays dramatic.
    expect(resolveNarrativeMode({ ...base, rating: 'Everyone', description: 'A cozy port town with pirate feuds.' })).toBe('dramatic')
    expect(resolveNarrativeMode({ ...cozy, rating: 'Teen' })).toBe('dramatic')
  })

  it('a gentle tone plus one soft keyword flips an Everyone world', () => {
    expect(
      resolveNarrativeMode({ ...base, tone: 'Whimsical Fairy Tale', rating: 'Everyone', description: 'A gentle land of sugar rivers.' }),
    ).toBe('gentle')
  })

  it('the gentle directive forbids manufactured conflict explicitly', () => {
    const d = gentleModeDirective()
    expect(d).toMatch(/no villains/i)
    expect(d).toMatch(/Do not manufacture conflict/i)
  })
})

describe('gentle arcs in the plot planner', () => {
  const GENTLE_IDS = ['shared_wonder', 'the_gathering', 'new_friend', 'something_grown']

  it('a gentle world only draws gentle arcs, and chains within them', () => {
    let state = PlotPlanner.init('The Sweetest Meadow', undefined, undefined, 'gentle')
    expect(GENTLE_IDS).toContain(state.arcId)
    // Run far enough to complete several arcs; every chained arc stays gentle.
    for (let i = 0; i < 30; i++) {
      state = PlotPlanner.advance(state)
      expect(GENTLE_IDS).toContain(state.arcId)
    }
    expect(state.arcsCompleted ?? 0).toBeGreaterThan(0)
  })

  it('a dramatic world never draws a gentle arc', () => {
    let state = PlotPlanner.init('The Broken Crown', undefined, undefined, 'dramatic')
    for (let i = 0; i < 30; i++) {
      state = PlotPlanner.advance(state)
      expect(GENTLE_IDS).not.toContain(state.arcId)
    }
  })

  it('gentle arc directives carry no threat language', () => {
    let state = PlotPlanner.init('The Sweetest Meadow', undefined, undefined, 'gentle')
    for (let i = 0; i < 16; i++) {
      const d = PlotPlanner.directive(state).toLowerCase()
      expect(d).not.toMatch(/threat|betray|enemy|danger/)
      state = PlotPlanner.advance(state)
    }
  })
})

describe('gentle pacing & stakes language', () => {
  it('drama directives reframe escalation as delight', () => {
    const dm = new DramaManager()
    expect(dm.directive('escalate', 'gentle')).toMatch(/delightful/i)
    expect(dm.directive('escalate', 'gentle')).not.toMatch(/threat/i)
    // Dramatic default unchanged.
    expect(dm.directive('escalate')).toMatch(/threat/i)
  })

  it('difficulty directives measure meaning, not danger', () => {
    expect(DifficultyManager.directive(0.9, 'gentle')).not.toMatch(/danger|threat/i)
    expect(DifficultyManager.directive(0.9, 'gentle')).toMatch(/matters deeply/i)
    expect(DifficultyManager.directive(0.9)).toMatch(/dangerous/i)
  })
})
