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
