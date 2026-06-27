import { describe, it, expect } from 'vitest'
import { GOAPPlanner } from '@/lib/engine/goap-planner'
import type { GOAPAction, GOAPGoal, PersonalityWeights } from '@/types/goap'

function action(over: Partial<GOAPAction> & Pick<GOAPAction, 'id' | 'effects'>): GOAPAction {
  return {
    name: over.id,
    cost: 1,
    preconditions: {},
    narrativeTemplate: '',
    category: 'narrative',
    ...over,
  }
}

function goal(desiredState: GOAPGoal['desiredState']): GOAPGoal {
  return { id: 'g', name: 'g', priority: 1, desiredState }
}

const NEUTRAL: PersonalityWeights = { aggression: 0, loyalty: 0, cunning: 0, courage: 0, greed: 0 }

describe('GOAPPlanner', () => {
  it('returns an empty plan when the goal is already satisfied', () => {
    const planner = new GOAPPlanner()
    const plan = planner.plan({ hasWood: true }, goal({ hasWood: true }), [])
    expect(plan).toEqual([])
  })

  it('finds a single-action plan', () => {
    const planner = new GOAPPlanner()
    const chop = action({ id: 'chop', effects: { hasWood: true } })
    const plan = planner.plan({ hasWood: false }, goal({ hasWood: true }), [chop])
    expect(plan).toEqual([chop])
  })

  it('chains actions through preconditions', () => {
    const planner = new GOAPPlanner()
    const goToForest = action({ id: 'goToForest', effects: { atForest: true } })
    const chop = action({ id: 'chop', preconditions: { atForest: true }, effects: { hasWood: true } })
    const plan = planner.plan(
      { atForest: false, hasWood: false },
      goal({ hasWood: true }),
      [chop, goToForest],
    )
    expect(plan).toEqual([goToForest, chop])
  })

  it('returns null when no action can satisfy the goal', () => {
    const planner = new GOAPPlanner()
    const chop = action({ id: 'chop', effects: { hasWood: true } })
    const plan = planner.plan({ hasGold: false }, goal({ hasGold: true }), [chop])
    expect(plan).toBeNull()
  })

  it('respects the maxDepth limit', () => {
    const a1 = action({ id: 'a1', effects: { s1: true } })
    const a2 = action({ id: 'a2', preconditions: { s1: true }, effects: { s2: true } })
    const a3 = action({ id: 'a3', preconditions: { s2: true }, effects: { s3: true } })
    const actions = [a1, a2, a3]
    const g = goal({ s3: true })
    const start = { s1: false, s2: false, s3: false }

    // A three-action plan is out of reach for a shallow planner...
    expect(new GOAPPlanner(2).plan(start, g, actions)).toBeNull()
    // ...but found when the depth budget is sufficient.
    expect(new GOAPPlanner(6).plan(start, g, actions)).toEqual([a1, a2, a3])
  })

  describe('isStateSubset', () => {
    const planner = new GOAPPlanner()

    it('is true when every key in the subset matches', () => {
      expect(planner.isStateSubset({ a: true }, { a: true, b: false })).toBe(true)
    })

    it('is false when a value differs', () => {
      expect(planner.isStateSubset({ a: true }, { a: false })).toBe(false)
    })

    it('is false when a key is missing from the state', () => {
      expect(planner.isStateSubset({ missing: true }, { a: true })).toBe(false)
    })

    it('an empty subset is contained in any state', () => {
      expect(planner.isStateSubset({}, { a: true })).toBe(true)
    })
  })

  describe('personality-driven cost', () => {
    // Two single-action routes to the same goal; personality decides the cheaper one.
    const offerAid = action({ id: 'social_offer_aid', category: 'social', cost: 5, effects: { resolved: true } })
    const betray = action({ id: 'social_betray', category: 'social', cost: 5, effects: { resolved: true } })
    const actions = [offerAid, betray]
    const g = goal({ resolved: true })
    const start = { resolved: false }

    it('the loyal prefer offering aid', () => {
      const planner = new GOAPPlanner()
      const loyal: PersonalityWeights = { ...NEUTRAL, loyalty: 1 }
      expect(planner.plan(start, g, actions, loyal)).toEqual([offerAid])
    })

    it('the cunning prefer betrayal', () => {
      const planner = new GOAPPlanner()
      const cunning: PersonalityWeights = { ...NEUTRAL, cunning: 1 }
      expect(planner.plan(start, g, actions, cunning)).toEqual([betray])
    })
  })
})
