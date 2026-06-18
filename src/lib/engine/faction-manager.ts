import { Faction, FactionAction, FactionActionContext, FactionRelationship } from '@/types/faction';
import { EconomyState } from '@/types/economy';
import { SeededRNG } from './seed-rng';

const FACTION_ACTIONS: FactionAction[] = [
  {
    id: 'expand_influence',
    name: 'Expand Influence',
    baseUtility: 30,
    evaluateUtility: (faction) =>
      faction.wealth > 60 && faction.influence < 80 ? 60 - faction.influence : 10,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    execute: (faction, _state) => {
      faction.influence = Math.min(100, faction.influence + 10);
      faction.wealth = Math.max(0, faction.wealth - 15);
      return {
        narrative: `${faction.name} consolidates power, spreading their influence across the region.`,
        effects: {},
      };
    },
  },
  {
    id: 'raid_neighbor',
    name: 'Raid Neighbor',
    baseUtility: 20,
    evaluateUtility: (faction) => {
      const hasEnemy = faction.relationships.some((r) => r.sentiment < -40);
      const foodLow = !faction.resources.some((r) => r.commodityId === 'food' && r.amount > 20);
      return hasEnemy && foodLow ? 70 : 15;
    },
    execute: (faction, state: FactionActionContext) => {
      const enemy = [...faction.relationships].sort((a, b) => a.sentiment - b.sentiment)[0];
      if (enemy && state.factions[enemy.factionId]) {
        const target = state.factions[enemy.factionId];
        target.wealth = Math.max(0, target.wealth - 20);
        faction.wealth = Math.min(200, faction.wealth + 15);
        const rel = faction.relationships.find((r) => r.factionId === enemy.factionId);
        if (rel) rel.sentiment = Math.max(-100, rel.sentiment - 10);
        const foodMarket = state.economy.markets['food'];
        if (foodMarket) foodMarket.supply = Math.max(0, foodMarket.supply - 15);
        return {
          narrative: `${faction.name} launches a raid against ${target.name}, seizing resources and disrupting trade.`,
          effects: { 'world.conflict': true },
        };
      }
      return { narrative: '', effects: {} };
    },
  },
  {
    id: 'forge_alliance',
    name: 'Forge Alliance',
    baseUtility: 25,
    evaluateUtility: (faction) => {
      const potentialAlly = faction.relationships.find((r) => r.sentiment > 20 && r.sentiment < 80);
      return potentialAlly ? 45 : 5;
    },
    execute: (faction, state: FactionActionContext) => {
      const candidate = faction.relationships.find((r) => r.sentiment > 20 && r.sentiment < 80);
      if (candidate && state.factions[candidate.factionId]) {
        candidate.sentiment = Math.min(100, candidate.sentiment + 20);
        const ally = state.factions[candidate.factionId];
        const reverse = ally.relationships.find((r) => r.factionId === faction.id);
        if (reverse) reverse.sentiment = Math.min(100, reverse.sentiment + 20);
        return {
          narrative: `${faction.name} brokers a new pact with ${ally.name}, strengthening ties between their peoples.`,
          effects: { 'world.alliance_formed': true },
        };
      }
      return { narrative: '', effects: {} };
    },
  },
  {
    id: 'establish_trade_route',
    name: 'Establish Trade Route',
    baseUtility: 20,
    evaluateUtility: (faction) => {
      const hasAlly = faction.relationships.some((r) => r.sentiment > 50);
      return hasAlly && faction.wealth < 80 ? 55 : 10;
    },
    execute: (faction, state: FactionActionContext) => {
      faction.wealth = Math.min(200, faction.wealth + 25);
      const ironMarket = state.economy.markets['iron'];
      if (ironMarket) ironMarket.supply = Math.min(100, ironMarket.supply + 10);
      const allyRel = faction.relationships.find((r) => r.sentiment > 50);
      const allyName = allyRel ? state.factions[allyRel.factionId]?.name ?? 'distant merchants' : 'distant merchants';
      return {
        narrative: `${faction.name} opens a prosperous trade route with ${allyName}, boosting commerce across the land.`,
        effects: { 'world.trade_active': true },
      };
    },
  },
];

export interface FactionTickResult {
  narrativeEvents: string[];
  updatedFactions: Record<string, Faction>;
}

const FACTION_TEMPLATES = [
  { name: 'Iron Vanguard', description: 'A disciplined military order', traits: ['militaristic', 'disciplined'], alignment: 'lawful_neutral' as const },
  { name: 'Ember Conclave', description: 'A secretive council of mages', traits: ['arcane', 'secretive'], alignment: 'true_neutral' as const },
  { name: 'Silver Pact', description: 'A mercantile guild controlling trade', traits: ['mercantile', 'opportunistic'], alignment: 'neutral_good' as const },
  { name: 'Ash Brotherhood', description: 'Outlaws and freedom fighters', traits: ['chaotic', 'resourceful'], alignment: 'chaotic_neutral' as const },
];

export class FactionManager {
  private rng: SeededRNG;

  constructor(tickSeed: number) {
    this.rng = new SeededRNG(tickSeed);
  }

  /** Procedurally generates the default faction set for a world. */
  public static generateDefaultFactions(worldSeed: number): Record<string, Faction> {
    const rng = new SeededRNG(worldSeed);
    const factions: Record<string, Faction> = {};

    for (let i = 0; i < FACTION_TEMPLATES.length; i++) {
      const tmpl = FACTION_TEMPLATES[i];
      const id = `faction_${i}`;
      const relationships: FactionRelationship[] = [];

      for (let j = 0; j < FACTION_TEMPLATES.length; j++) {
        if (i === j) continue;
        relationships.push({ factionId: `faction_${j}`, sentiment: rng.nextInt(-60, 60) });
      }

      factions[id] = {
        id,
        name: tmpl.name,
        description: tmpl.description,
        alignment: tmpl.alignment,
        wealth: rng.nextInt(40, 80),
        influence: rng.nextInt(30, 70),
        resources: [
          { commodityId: 'food', amount: rng.nextInt(20, 60) },
          { commodityId: 'iron', amount: rng.nextInt(10, 50) },
        ],
        relationships,
        traits: tmpl.traits,
      };
    }

    return factions;
  }

  /** Runs one simulation tick for all factions, mutating state in place. */
  public tick(factions: Record<string, Faction>, economy: EconomyState): FactionTickResult {
    const narrativeEvents: string[] = [];
    const state: FactionActionContext = { factions, economy };

    for (const faction of Object.values(factions)) {
      let bestAction: FactionAction | null = null;
      let bestScore = -Infinity;

      for (const action of FACTION_ACTIONS) {
        const score = action.evaluateUtility(faction, state);
        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
      }

      // 10% random chance to skip even the best action (unpredictability)
      if (bestAction && bestScore > 20 && this.rng.nextFloat() > 0.1) {
        const result = bestAction.execute(faction, state);
        if (result.narrative) narrativeEvents.push(result.narrative);
      }
    }

    return { narrativeEvents, updatedFactions: factions };
  }

  /** Returns a brief summary of the most powerful faction for prompt injection. */
  public static getSummary(factions: Record<string, Faction>): string {
    const list = Object.values(factions);
    if (list.length === 0) return '';
    const dominant = list.reduce((a, b) => (a.influence > b.influence ? a : b));
    const rivalries = list
      .flatMap((f) =>
        f.relationships
          .filter((r) => r.sentiment < -50)
          .map((r) => `${f.name} is hostile to ${factions[r.factionId]?.name ?? 'rivals'}`),
      )
      .slice(0, 2);

    const parts: string[] = [`${dominant.name} holds the most influence.`];
    if (rivalries.length > 0) parts.push(...rivalries);
    return `Faction Status: ${parts.join(' ')}`;
  }
}
