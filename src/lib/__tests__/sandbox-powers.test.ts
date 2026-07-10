import { describe, it, expect } from 'vitest'
import { initSandboxState, MAX_EVENT_LOG, type SandboxState } from '@/lib/world-sandbox'
import { DIVINE_POWERS, HERO_DEEDS, AMBITIONS, availableActs, invokeAct } from '@/lib/sandbox-powers'

function power(id: string) {
  const act = DIVINE_POWERS.find((a) => a.id === id)
  if (!act) throw new Error(`no such power: ${id}`)
  return act
}

function firstFactions(state: SandboxState): string[] {
  return Object.keys(state.factions)
}

describe('availableActs', () => {
  it('gentle worlds genuinely lose every harmful power', () => {
    const acts = availableActs(DIVINE_POWERS, true)
    expect(acts.every((a) => a.gentleSafe)).toBe(true)
    expect(acts.map((a) => a.id)).not.toContain('creeping_blight')
    expect(acts.map((a) => a.id)).not.toContain('seeds_of_discord')
  })

  it('non-gentle worlds keep the full palette', () => {
    expect(availableActs(DIVINE_POWERS, false)).toEqual(DIVINE_POWERS)
  })

  it('every hero deed is gentle-safe and free', () => {
    expect(HERO_DEEDS.every((d) => d.gentleSafe && d.cost === 0)).toBe(true)
  })
})

describe('invokeAct', () => {
  it('applies the effect, spends faith, and writes a flavor line to the event log', () => {
    const state = initSandboxState(42)
    const [id] = firstFactions(state)
    const act = power('golden_favor')
    const result = invokeAct(state, act, [id])
    expect(result).not.toBeNull()
    expect(result!.state.factions[id].wealth).toBe(Math.min(200, state.factions[id].wealth + 25))
    expect(result!.state.faith).toBe(state.faith - act.cost)
    expect(result!.state.eventLog[result!.state.eventLog.length - 1]).toBe(result!.line)
    expect(result!.line).toContain(state.factions[id].name)
  })

  it('returns null (no partial spend) when faith is short', () => {
    const state = { ...initSandboxState(42), faith: 0 }
    const [id] = firstFactions(state)
    expect(invokeAct(state, power('golden_favor'), [id])).toBeNull()
  })

  it('returns null for an invalid target instead of charging faith', () => {
    const state = initSandboxState(42)
    expect(invokeAct(state, power('golden_favor'), ['nope'])).toBeNull()
    expect(invokeAct(state, power('blessing_of_plenty'), ['unobtainium'])).toBeNull()
  })

  it('never mutates the input state', () => {
    const state = initSandboxState(42)
    const before = JSON.parse(JSON.stringify(state))
    invokeAct(state, power('bond_of_kinship'), firstFactions(state).slice(0, 2))
    expect(state).toEqual(before)
  })

  it('pair powers move BOTH directions of sentiment', () => {
    const state = initSandboxState(42)
    const [a, b] = firstFactions(state)
    const before = {
      aToB: state.factions[a].relationships.find((r) => r.factionId === b)?.sentiment ?? 0,
      bToA: state.factions[b].relationships.find((r) => r.factionId === a)?.sentiment ?? 0,
    }
    const result = invokeAct(state, power('bond_of_kinship'), [a, b])!
    const after = {
      aToB: result.state.factions[a].relationships.find((r) => r.factionId === b)?.sentiment,
      bToA: result.state.factions[b].relationships.find((r) => r.factionId === a)?.sentiment,
    }
    expect(after.aToB).toBe(Math.min(100, before.aToB + 35))
    expect(after.bToA).toBe(Math.min(100, before.bToA + 35))
  })

  it('a pair power aimed at the same faction twice is rejected', () => {
    const state = initSandboxState(42)
    const [a] = firstFactions(state)
    expect(invokeAct(state, power('bond_of_kinship'), [a, a])).toBeNull()
  })

  it('untargeted powers (tension) need no target and clamp via the shared setter', () => {
    const state = { ...initSandboxState(42), tension: 0.05 }
    const result = invokeAct(state, power('still_waters'), [])!
    expect(result.state.tension).toBe(0)
  })

  it('market powers recompute price through the shared formula', () => {
    const state = initSandboxState(42)
    const before = state.economy.markets.food
    const result = invokeAct(state, power('blessing_of_plenty'), ['food'])!
    const after = result.state.economy.markets.food
    expect(after.supply).toBe(Math.min(100, before.supply + 25))
    expect(after.currentPrice).not.toBe(before.currentPrice)
  })

  it('caps the event log at MAX_EVENT_LOG', () => {
    let state: SandboxState = { ...initSandboxState(42), eventLog: Array.from({ length: MAX_EVENT_LOG }, (_, i) => `old ${i}`) }
    state = invokeAct(state, power('still_waters'), [])!.state
    expect(state.eventLog.length).toBe(MAX_EVENT_LOG)
    expect(state.eventLog[0]).toBe('old 1') // oldest dropped
  })

  it('hero deeds resolve free and land smaller than the divine version', () => {
    const state = initSandboxState(42)
    const deed = HERO_DEEDS.find((d) => d.id === 'pitch_in')!
    const result = invokeAct(state, deed, ['food'])!
    expect(result.state.faith).toBe(state.faith) // free
    expect(result.state.economy.markets.food.supply).toBe(Math.min(100, state.economy.markets.food.supply + 8))
  })
})

describe('AMBITIONS', () => {
  it('every ambition reports 0..1 on a fresh world and 1 on an engineered win', () => {
    const fresh = initSandboxState(42)
    for (const ambition of AMBITIONS) {
      const p = ambition.progress(fresh)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })

  it('dominion completes when any faction reaches influence 90', () => {
    const state = initSandboxState(42)
    const [id] = Object.keys(state.factions)
    state.factions[id].influence = 95
    expect(AMBITIONS.find((a) => a.id === 'dominion')!.progress(state)).toBe(1)
  })

  it('age_of_harmony tracks the WORST relationship, done at +40', () => {
    const state = initSandboxState(42)
    for (const f of Object.values(state.factions)) for (const r of f.relationships) r.sentiment = 40
    expect(AMBITIONS.find((a) => a.id === 'age_of_harmony')!.progress(state)).toBe(1)
    const one = Object.values(state.factions)[0]
    if (one.relationships[0]) one.relationships[0].sentiment = -100
    expect(AMBITIONS.find((a) => a.id === 'age_of_harmony')!.progress(state)).toBe(0)
  })

  it('golden_age and world_of_plenty complete on engineered prosperity', () => {
    const state = initSandboxState(42)
    for (const f of Object.values(state.factions)) f.wealth = 85
    for (const m of Object.values(state.economy.markets)) m.supply = 75
    expect(AMBITIONS.find((a) => a.id === 'golden_age')!.progress(state)).toBe(1)
    expect(AMBITIONS.find((a) => a.id === 'world_of_plenty')!.progress(state)).toBe(1)
  })
})
