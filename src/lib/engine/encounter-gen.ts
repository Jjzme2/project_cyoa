import { EncounterTable, EncounterEntry, Biome } from '@/types/procgen';
import { WorldState } from '@/types/goap';
import { SeededRNG } from './seed-rng';
import { GOAPPlanner } from './goap-planner';

export class EncounterGenerator {
  private rng: SeededRNG;
  private planner: GOAPPlanner;

  constructor(seed: number) {
    this.rng = new SeededRNG(seed);
    this.planner = new GOAPPlanner();
  }

  // Very basic encounter tables for Phase 1
  private tables: Record<Biome | 'general', EncounterTable> = {
    forest: {
      totalWeight: 100,
      entries: [
        { id: 'f1', weight: 40, description: 'A rustling in the bushes', preconditions: {}, effects: {}, narrativeHook: 'You hear a sudden rustling in the dense undergrowth nearby.' },
        { id: 'f2', weight: 30, description: 'Found berries', preconditions: {}, effects: { 'player.hasFood': true }, narrativeHook: 'You spot a bush laden with ripe, edible berries.' },
        { id: 'f3', weight: 30, description: 'Bandit ambush', preconditions: { 'player.underAttack': false }, effects: { 'player.underAttack': true }, narrativeHook: 'A group of rough-looking bandits steps out from behind the trees, weapons drawn.' },
      ]
    },
    general: {
      totalWeight: 100,
      entries: [
        { id: 'g1', weight: 50, description: 'Quiet moment', preconditions: {}, effects: {}, narrativeHook: 'The area is eerily quiet.' },
        { id: 'g2', weight: 50, description: 'Found a trinket', preconditions: {}, effects: {}, narrativeHook: 'You spot a glint of metal half-buried in the dirt.' },
      ]
    },
    // Fallback empty tables for other biomes for now
    desert: { totalWeight: 0, entries: [] },
    mountains: { totalWeight: 0, entries: [] },
    swamp: { totalWeight: 0, entries: [] },
    tundra: { totalWeight: 0, entries: [] },
    coast: { totalWeight: 0, entries: [] },
    caverns: { totalWeight: 0, entries: [] },
    plains: { totalWeight: 0, entries: [] },
    volcanic: { totalWeight: 0, entries: [] },
    ruins: { totalWeight: 0, entries: [] },
  };

  /**
   * Rolls an encounter for the given biome and state.
   * Returns null if no encounter triggered (e.g. 50% chance of nothing happening).
   */
  public generateEncounter(nodePath: string, biome: Biome, currentState: WorldState): EncounterEntry | null {
    const encounterRng = new SeededRNG(SeededRNG.deriveSeed(this.rng['state'], nodePath + '_encounter'));
    
    // 50% chance for an encounter at all
    if (encounterRng.nextFloat() > 0.5) {
      return null;
    }

    let table = this.tables[biome];
    if (!table || table.entries.length === 0) {
      table = this.tables['general'];
    }

    // Filter valid entries based on preconditions
    const validEntries = table.entries.filter(entry => 
      this.planner.isStateSubset(entry.preconditions, currentState)
    );

    if (validEntries.length === 0) return null;

    // Weighted random selection
    const totalWeight = validEntries.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = encounterRng.nextInt(1, totalWeight);

    for (const entry of validEntries) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry;
      }
    }

    return null;
  }
}
