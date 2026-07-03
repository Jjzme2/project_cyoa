import { SeededRNG } from './seed-rng';

/**
 * HTN-style plot planner. Where the quest system runs side-arcs and the Director
 * paces tension, this gives the *whole story* a planned through-line: a compound
 * narrative goal decomposed into ordered beats (setup → development → climax →
 * consequence). It advances a beat every couple of chapters and is persisted per
 * node — so each branch carries the through-line forward from where it forked.
 * The result is planned narrative, not just reactive systems.
 */

export interface PlotState {
  arcId: string;
  beatIndex: number;
  turnsOnBeat: number;
  /** How many through-lines have already resolved — long stories chain arcs. */
  arcsCompleted?: number;
}

/** Narrative phase for a beat, so the prompt conveys where in the arc we are. */
const PHASES = ['Setup', 'Rising action', 'Turning point', 'Resolution'];

interface PlotArc {
  id: string;
  name: string;
  /** Ordered director instructions, one per beat. */
  beats: string[];
}

const ARCS: PlotArc[] = [
  {
    id: 'rising_betrayal',
    name: 'Rising Betrayal',
    beats: [
      'plant a subtle seed of distrust between the protagonist and someone they rely on',
      'let a fragile alliance hold despite that undercurrent of doubt',
      'bring the betrayal into the open at the worst possible moment',
      'force a reckoning with its fallout',
    ],
  },
  {
    id: 'forge_and_test',
    name: 'Forge and Test',
    beats: [
      'introduce a threat no one can face alone',
      'push wary parties into an uneasy alliance',
      'strain that alliance with a hard, divisive choice',
      'demand a final proof of loyalty that decides everything',
    ],
  },
  {
    id: 'hidden_truth',
    name: 'The Hidden Truth',
    beats: [
      'surface a small detail that does not add up',
      'let unanswered questions accumulate and unsettle the protagonist',
      'reveal a truth that recontextualizes what came before',
      'deal with the weight of knowing',
    ],
  },
  {
    id: 'fall_and_rise',
    name: 'Fall and Rise',
    beats: [
      'let the protagonist suffer a real and costly setback',
      'sink them to their lowest point, stripped of an advantage',
      'spark the turn — a hard-won insight or unlikely ally',
      'drive toward reclaiming what was lost, changed by it',
    ],
  },
];

/**
 * Conflict-free through-lines for GENTLE worlds: the same four-beat structure
 * (setup → rising → turning point → resolution), but the turning point is a
 * peak of wonder, connection, or achievement — never a threat or betrayal.
 */
const GENTLE_ARCS: PlotArc[] = [
  {
    id: 'shared_wonder',
    name: 'A Shared Wonder',
    beats: [
      'plant a small, curious marvel that catches the protagonist’s attention',
      'let curiosity gather friends and momentum, each clue more delightful than the last',
      'unveil the wonder in full — a moment of awe shared together',
      'savor what it means, and how it has drawn everyone closer',
    ],
  },
  {
    id: 'the_gathering',
    name: 'The Gathering',
    beats: [
      'seed a happy occasion on the horizon that the whole place begins preparing for',
      'weave the preparations — small tasks, helping hands, rising anticipation',
      'let the occasion arrive in its full warmth — the moment everyone made together',
      'wind down into gratitude, keepsakes, and plans to do it again',
    ],
  },
  {
    id: 'new_friend',
    name: 'A New Friend',
    beats: [
      'introduce a newcomer or shy soul at the edge of things',
      'grow the acquaintance through small kindnesses and shared moments',
      'arrive at a heartfelt exchange — the moment two hearts truly understand each other',
      'settle into the comfort of belonging, the world a little warmer for it',
    ],
  },
  {
    id: 'something_grown',
    name: 'Something Grown',
    beats: [
      'begin a labor of love — a garden, a craft, a gift being made',
      'tend it through gentle snags (weather, tangles, learning) met with patience',
      'watch it come to life — the bloom, the finished work, the surprise it becomes',
      'share it, and let the sharing matter more than the thing itself',
    ],
  },
];

const ALL_ARCS = [...ARCS, ...GENTLE_ARCS];
const GENTLE_IDS = new Set(GENTLE_ARCS.map((a) => a.id));

const CHAPTERS_PER_BEAT = 2;

export const PlotPlanner = {
  init(
    storyTitle: string,
    prior?: PlotState,
    persona?: { darkness?: number },
    mode: 'dramatic' | 'gentle' = 'dramatic',
  ): PlotState {
    if (prior) return prior;
    // A gentle world draws only from the conflict-free arcs; a dramatic one
    // keeps the traditional pool, leaned by the director's darkness (dark steers
    // away from the heroic alliance arc; warm steers toward it).
    let pool: PlotArc[];
    if (mode === 'gentle') {
      pool = GENTLE_ARCS;
    } else {
      const dark = persona?.darkness ?? 0;
      pool = ARCS;
      if (dark > 0.3) pool = ARCS.filter((a) => a.id !== 'forge_and_test');
      else if (dark < -0.3) pool = ARCS.filter((a) => a.id === 'forge_and_test');
    }
    const arc = pool[SeededRNG.hashString(storyTitle) % pool.length];
    return { arcId: arc.id, beatIndex: 0, turnsOnBeat: 0, arcsCompleted: 0 };
  },

  advance(state: PlotState): PlotState {
    const arc = ALL_ARCS.find((a) => a.id === state.arcId) ?? ARCS[0];
    const arcsCompleted = state.arcsCompleted ?? 0;
    const turnsOnBeat = state.turnsOnBeat + 1;

    if (turnsOnBeat >= CHAPTERS_PER_BEAT) {
      if (state.beatIndex < arc.beats.length - 1) {
        return { ...state, beatIndex: state.beatIndex + 1, turnsOnBeat: 0, arcsCompleted };
      }
      // The arc has resolved. Rather than plateau on the final beat (which made
      // long stories stall), chain into a fresh through-line — a new movement —
      // deterministically chosen so it differs from the one that just ended.
      // Chaining stays within the arc's own family: a gentle story never drifts
      // into a betrayal arc (and vice versa).
      const family = GENTLE_IDS.has(arc.id) ? GENTLE_ARCS : ARCS;
      const others = family.filter((a) => a.id !== arc.id);
      const next = others[(arcsCompleted + SeededRNG.hashString(arc.id)) % others.length];
      return { arcId: next.id, beatIndex: 0, turnsOnBeat: 0, arcsCompleted: arcsCompleted + 1 };
    }
    return { ...state, turnsOnBeat, arcsCompleted };
  },

  directive(state: PlotState): string {
    const arc = ALL_ARCS.find((a) => a.id === state.arcId);
    if (!arc) return '';
    const i = Math.min(state.beatIndex, arc.beats.length - 1);
    const beat = arc.beats[i];
    const phase = PHASES[Math.min(i, PHASES.length - 1)];
    const movement = (state.arcsCompleted ?? 0) > 0 ? ` (movement ${(state.arcsCompleted ?? 0) + 1})` : '';
    return `Story through-line${movement} — "${arc.name}", ${phase}: ${beat}.`;
  },
};
