import { describe, it, expect } from 'vitest'
import { PlotPlanner } from '@/lib/engine/plot-planner'

describe('PlotPlanner', () => {
  it('initializes a fresh arc at the setup beat', () => {
    const s = PlotPlanner.init('A Tale of Two Cities')
    expect(s.beatIndex).toBe(0)
    expect(s.arcsCompleted).toBe(0)
    expect(PlotPlanner.directive(s)).toContain('Setup')
  })

  it('labels the narrative phase by beat', () => {
    let cur = PlotPlanner.init('X')
    cur = PlotPlanner.advance(cur) // turnsOnBeat 1
    cur = PlotPlanner.advance(cur) // → beat 1
    expect(cur.beatIndex).toBe(1)
    expect(PlotPlanner.directive(cur)).toContain('Rising action')
  })

  it('chains into a new movement when an arc resolves (no plateau)', () => {
    let cur = PlotPlanner.init('Chained')
    const firstArc = cur.arcId
    // 4 beats × 2 turns each → the arc resolves and chains on the 8th advance.
    for (let i = 0; i < 8; i++) cur = PlotPlanner.advance(cur)
    expect(cur.arcsCompleted).toBe(1)
    expect(cur.arcId).not.toBe(firstArc)
    expect(cur.beatIndex).toBe(0)
    expect(PlotPlanner.directive(cur)).toContain('movement 2')
  })

  it('preserves a provided prior state so branches carry the through-line forward', () => {
    const prior = { arcId: 'hidden_truth', beatIndex: 2, turnsOnBeat: 1, arcsCompleted: 0 }
    expect(PlotPlanner.init('whatever', prior)).toEqual(prior)
  })
})

describe('PlotPlanner — dark and absurd arcs', () => {
  const DARK_IDS = ['creeping_corruption', 'debt_collector', 'last_good_thing', 'mask_slips']
  const ABSURD_IDS = ['escalating_nonsense', 'bureaucracy_of_the_bizarre', 'wrong_hero', 'curse_of_mild_inconvenience']

  it('a dark world only draws dark arcs, and chains within them', () => {
    let state = PlotPlanner.init('The Long Rot', undefined, undefined, 'dark')
    expect(DARK_IDS).toContain(state.arcId)
    for (let i = 0; i < 30; i++) {
      state = PlotPlanner.advance(state)
      expect(DARK_IDS).toContain(state.arcId)
    }
    expect(state.arcsCompleted ?? 0).toBeGreaterThan(0)
  })

  it('an absurd world only draws absurd arcs, and chains within them', () => {
    let state = PlotPlanner.init('The Silly Kingdom', undefined, undefined, 'absurd')
    expect(ABSURD_IDS).toContain(state.arcId)
    for (let i = 0; i < 30; i++) {
      state = PlotPlanner.advance(state)
      expect(ABSURD_IDS).toContain(state.arcId)
    }
    expect(state.arcsCompleted ?? 0).toBeGreaterThan(0)
  })
})

describe('PlotPlanner — custom AI-generated arc', () => {
  const customArc = { name: 'The Clockwork Heart', beats: ['wind it', 'test it', 'break it', 'mend it'] }

  it('a custom mode with a provided arc seeds directly from it', () => {
    const state = PlotPlanner.init('Any Title', undefined, undefined, 'custom', customArc)
    expect(state.arcId).toBe('custom')
    expect(state.customArc).toEqual(customArc)
    expect(PlotPlanner.directive(state)).toContain('The Clockwork Heart')
    expect(PlotPlanner.directive(state)).toContain('wind it')
  })

  it('replays the same custom arc as a fresh movement once its beats are exhausted', () => {
    let state = PlotPlanner.init('Any Title', undefined, undefined, 'custom', customArc)
    for (let i = 0; i < 8; i++) state = PlotPlanner.advance(state)
    expect(state.beatIndex).toBe(0)
    expect(state.arcsCompleted).toBe(1)
    expect(state.customArc).toEqual(customArc)
    expect(PlotPlanner.directive(state)).toContain('movement 2')
  })

  it('falls back to the curated dramatic pool if custom mode has no arc yet', () => {
    const state = PlotPlanner.init('Any Title', undefined, undefined, 'custom', undefined)
    expect(state.arcId).not.toBe('custom')
  })
})
