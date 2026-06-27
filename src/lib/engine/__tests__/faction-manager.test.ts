import { describe, it, expect } from 'vitest'
import { FactionManager } from '@/lib/engine/faction-manager'
import type { Faction } from '@/types/faction'
import type { EconomyState } from '@/types/economy'
import type { GenesisFaction } from '@/types'

function names(factions: Record<string, Faction>): string[] {
  return Object.values(factions).map((f) => f.name)
}

function makeEconomy(): EconomyState {
  return {
    globalWealth: 1000,
    markets: {
      food: { commodityId: 'food', supply: 50, demand: 50, currentPrice: 10 },
      iron: { commodityId: 'iron', supply: 50, demand: 50, currentPrice: 20 },
    },
  }
}

describe('FactionManager.generateDefaultFactions', () => {
  it('is fully deterministic for the same seeds', () => {
    const a = FactionManager.generateDefaultFactions(42)
    const b = FactionManager.generateDefaultFactions(42)
    expect(a).toEqual(b)
  })

  it('generates between 3 and 5 factions', () => {
    for (const seed of [1, 7, 42, 100, 2024]) {
      const count = Object.keys(FactionManager.generateDefaultFactions(seed)).length
      expect(count).toBeGreaterThanOrEqual(3)
      expect(count).toBeLessThanOrEqual(5)
    }
  })

  it('gives each faction a relationship to every other faction', () => {
    const factions = FactionManager.generateDefaultFactions(42)
    const ids = Object.keys(factions)
    for (const f of Object.values(factions)) {
      expect(f.relationships).toHaveLength(ids.length - 1)
      expect(f.relationships.map((r) => r.factionId)).not.toContain(f.id)
    }
  })

  it('keeps identity (names) tied to the world seed but varies dynamics with the dynamics seed', () => {
    const a = FactionManager.generateDefaultFactions(100, 1)
    const b = FactionManager.generateDefaultFactions(100, 2)
    // Same world → same powers, named identically.
    expect(names(a)).toEqual(names(b))
    // Different dynamics seed → the politics/economics differ.
    expect(a).not.toEqual(b)
  })

  it('produces different powers for different world seeds', () => {
    const a = FactionManager.generateDefaultFactions(1)
    const b = FactionManager.generateDefaultFactions(999)
    expect(names(a)).not.toEqual(names(b))
  })
})

describe('FactionManager.fromGenesis', () => {
  const genesis: GenesisFaction[] = [
    { name: 'Iron Legion', archetype: 'martial order', seat: 'North', founding: 'old', rivalOf: 'Shadow Pact', allyOf: null },
    { name: 'Shadow Pact', archetype: 'outlaw band', seat: 'South', founding: 'recent', rivalOf: 'Iron Legion', allyOf: 'Coin Guild' },
    { name: 'Coin Guild', archetype: 'merchant power', seat: 'East', founding: 'ancient', rivalOf: null, allyOf: 'Shadow Pact' },
  ]

  it('preserves genesis names and maps known archetypes to alignment', () => {
    const factions = FactionManager.fromGenesis(genesis, 5)
    expect(names(factions)).toEqual(['Iron Legion', 'Shadow Pact', 'Coin Guild'])
    expect(factions['faction_0'].alignment).toBe('lawful_neutral') // martial order
    expect(factions['faction_2'].alignment).toBe('neutral_good') // merchant power
  })

  it('makes rivals hostile and allies friendly', () => {
    const factions = FactionManager.fromGenesis(genesis, 5)
    const legionToPact = factions['faction_0'].relationships.find((r) => r.factionId === 'faction_1')
    const pactToGuild = factions['faction_1'].relationships.find((r) => r.factionId === 'faction_2')
    expect(legionToPact!.sentiment).toBeLessThan(-50) // rival
    expect(pactToGuild!.sentiment).toBeGreaterThan(50) // ally
  })

  it('falls back to true_neutral for unknown archetypes', () => {
    const odd: GenesisFaction[] = [
      { name: 'The Unknowable', archetype: 'eldritch mystery', seat: 'Void', founding: 'never', rivalOf: null, allyOf: null },
      { name: 'Plainfolk', archetype: 'martial order', seat: 'Hills', founding: 'old', rivalOf: null, allyOf: null },
    ]
    const factions = FactionManager.fromGenesis(odd, 1)
    expect(factions['faction_0'].alignment).toBe('true_neutral')
  })
})

describe('FactionManager.getSummary', () => {
  it('returns an empty string when there are no factions', () => {
    expect(FactionManager.getSummary({})).toBe('')
  })

  it('names the most influential faction', () => {
    const factions = FactionManager.generateDefaultFactions(42)
    const dominant = Object.values(factions).reduce((a, b) => (a.influence > b.influence ? a : b))
    const summary = FactionManager.getSummary(factions)
    expect(summary).toContain(dominant.name)
    expect(summary).toMatch(/most influence/i)
  })

  it('surfaces strong rivalries', () => {
    const factions: Record<string, Faction> = {
      faction_0: {
        id: 'faction_0', name: 'Alpha', description: '', alignment: 'true_neutral',
        wealth: 50, influence: 90, resources: [], traits: [],
        relationships: [{ factionId: 'faction_1', sentiment: -80 }],
      },
      faction_1: {
        id: 'faction_1', name: 'Beta', description: '', alignment: 'true_neutral',
        wealth: 50, influence: 40, resources: [], traits: [],
        relationships: [{ factionId: 'faction_0', sentiment: -80 }],
      },
    }
    const summary = FactionManager.getSummary(factions)
    expect(summary).toContain('Alpha holds the most influence')
    expect(summary).toMatch(/Alpha is hostile to Beta|Beta is hostile to Alpha/)
  })
})

describe('FactionManager.tick', () => {
  it('is deterministic for a given tick seed', () => {
    const economyA = makeEconomy()
    const economyB = makeEconomy()
    const factionsA = FactionManager.generateDefaultFactions(42, 7)
    const factionsB = FactionManager.generateDefaultFactions(42, 7)

    const resultA = new FactionManager(123).tick(factionsA, economyA)
    const resultB = new FactionManager(123).tick(factionsB, economyB)

    expect(resultA.narrativeEvents).toEqual(resultB.narrativeEvents)
    expect(factionsA).toEqual(factionsB)
  })

  it('returns the same faction map it mutates in place', () => {
    const economy = makeEconomy()
    const factions = FactionManager.generateDefaultFactions(42, 7)
    const result = new FactionManager(1).tick(factions, economy)
    expect(result.updatedFactions).toBe(factions)
    expect(Array.isArray(result.narrativeEvents)).toBe(true)
  })
})
