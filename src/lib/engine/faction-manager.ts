import { Faction, FactionAction, FactionActionContext, FactionRelationship } from '@/types/faction';
import { EconomyState } from '@/types/economy';
import { SeededRNG } from './seed-rng';
import { NameGenerator } from './name-gen';

const pv = (state: FactionActionContext, arr: string[]): string => (state.pickVariant ? state.pickVariant(arr) : arr[0]);

const FACTION_ACTIONS: FactionAction[] = [
  {
    id: 'expand_influence',
    name: 'Expand Influence',
    baseUtility: 30,
    evaluateUtility: (faction) =>
      faction.wealth > 60 && faction.influence < 80 ? 60 - faction.influence : 10,
    execute: (faction, state) => {
      faction.influence = Math.min(100, faction.influence + 10);
      faction.wealth = Math.max(0, faction.wealth - 15);
      return {
        narrative: pv(state, [
          `${faction.name} consolidates power, spreading their influence across the region.`,
          `${faction.name} extends its reach, and lesser powers take notice.`,
          `The hand of ${faction.name} grows heavier upon the land.`,
        ]),
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
          narrative: pv(state, [
            `${faction.name} launches a raid against ${target.name}, seizing resources and disrupting trade.`,
            `Border villages burn as ${faction.name} strikes at ${target.name}.`,
            `${faction.name} bleeds ${target.name} with a swift, brutal incursion.`,
          ]),
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
          narrative: pv(state, [
            `${faction.name} brokers a pact with ${ally.name}, strengthening ties between their peoples.`,
            `Envoys of ${faction.name} and ${ally.name} seal a quiet understanding.`,
            `${faction.name} and ${ally.name} find common cause, however fragile it may prove.`,
          ]),
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
        narrative: pv(state, [
          `${faction.name} opens a prosperous trade route with ${allyName}, and coin flows freely.`,
          `Caravans of ${faction.name} reach ${allyName}; markets stir to life.`,
          `${faction.name} secures new commerce with ${allyName}.`,
        ]),
        effects: { 'world.trade_active': true },
      };
    },
  },
];

export interface FactionTickResult {
  narrativeEvents: string[];
  updatedFactions: Record<string, Faction>;
}

type Alignment = Faction['alignment'];

/** Faction archetypes — the *kind* of power, named uniquely per world. */
const ARCHETYPES: {
  nouns: string[];
  traits: string[];
  alignment: Alignment;
  descVariants: string[];
}[] = [
  {
    nouns: ['Vanguard', 'Legion', 'Host', 'Wardens', 'Bulwark'],
    traits: ['militaristic', 'disciplined'],
    alignment: 'lawful_neutral',
    descVariants: ['a disciplined military order', 'an iron-willed martial host', 'a fortress-born legion'],
  },
  {
    nouns: ['Conclave', 'Circle', 'Covenant', 'Synod', 'Veil'],
    traits: ['arcane', 'secretive'],
    alignment: 'true_neutral',
    descVariants: ['a secretive council of mages', 'a hidden circle of adepts', 'a guarded order of the arcane'],
  },
  {
    nouns: ['Pact', 'Guild', 'League', 'Syndicate', 'Concord'],
    traits: ['mercantile', 'opportunistic'],
    alignment: 'neutral_good',
    descVariants: ['a mercantile guild that controls trade', 'a far-reaching trade league', 'a coin-driven syndicate'],
  },
  {
    nouns: ['Brotherhood', 'Free Company', 'Reavers', 'Untamed', 'Wolves'],
    traits: ['chaotic', 'resourceful'],
    alignment: 'chaotic_neutral',
    descVariants: ['a band of reavers and rebels', 'an untamed free company', 'outlaws and freedom fighters'],
  },
  {
    nouns: ['Faithful', 'Choir', 'Communion', 'Flame', 'Devout'],
    traits: ['zealous', 'devout'],
    alignment: 'lawful_neutral',
    descVariants: ['a fervent religious movement', 'a militant faith', 'a prophet-led communion'],
  },
];

export class FactionManager {
  private rng: SeededRNG;

  constructor(tickSeed: number) {
    this.rng = new SeededRNG(tickSeed);
  }

  /**
   * Generates a world's factions. Their identity (names, kinds, descriptions) is
   * derived from the WORLD seed — so every world has its own distinct powers, yet
   * they stay consistent across that world's stories. Their dynamics (wealth,
   * influence, starting relationships) use the optional dynamics seed — so each
   * story's politics unfold differently.
   */
  public static generateDefaultFactions(worldSeed: number, dynamicsSeed?: number): Record<string, Faction> {
    const worldRng = new SeededRNG(worldSeed);
    const nameGen = new NameGenerator(SeededRNG.deriveSeed(worldSeed, 'factions'));
    const dynRng = new SeededRNG(dynamicsSeed ?? worldSeed);

    // Each world draws a different subset (and count) of archetypes.
    const pool = [...ARCHETYPES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = worldRng.nextInt(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const count = worldRng.nextInt(3, Math.min(5, pool.length));
    const chosen = pool.slice(0, count);

    const factions: Record<string, Faction> = {};
    chosen.forEach((arch, i) => {
      const proper = nameGen.generateName('short');
      const noun = worldRng.pick(arch.nouns);
      const name = worldRng.nextFloat() < 0.5 ? `The ${proper} ${noun}` : `${noun} of ${proper}`;

      const relationships: FactionRelationship[] = [];
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        relationships.push({ factionId: `faction_${j}`, sentiment: dynRng.nextInt(-60, 60) });
      }

      factions[`faction_${i}`] = {
        id: `faction_${i}`,
        name,
        description: worldRng.pick(arch.descVariants),
        alignment: arch.alignment,
        wealth: dynRng.nextInt(40, 80),
        influence: dynRng.nextInt(30, 70),
        resources: [
          { commodityId: 'food', amount: dynRng.nextInt(20, 60) },
          { commodityId: 'iron', amount: dynRng.nextInt(10, 50) },
        ],
        relationships,
        traits: arch.traits,
      };
    });

    return factions;
  }

  /** Runs one simulation tick for all factions, mutating state in place. */
  public tick(factions: Record<string, Faction>, economy: EconomyState): FactionTickResult {
    const narrativeEvents: string[] = [];
    const state: FactionActionContext = { factions, economy, pickVariant: (arr) => this.rng.pick(arr) };

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

      // Factions act on a strong impulse only ~half the time, so the world
      // doesn't announce something every single chapter.
      if (bestAction && bestScore > 28 && this.rng.nextFloat() > 0.5) {
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
