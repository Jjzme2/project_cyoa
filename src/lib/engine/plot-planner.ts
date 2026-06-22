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
}

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

const CHAPTERS_PER_BEAT = 2;

export const PlotPlanner = {
  init(storyTitle: string, prior?: PlotState): PlotState {
    if (prior) return prior;
    const arc = ARCS[SeededRNG.hashString(storyTitle) % ARCS.length];
    return { arcId: arc.id, beatIndex: 0, turnsOnBeat: 0 };
  },

  advance(state: PlotState): PlotState {
    const arc = ARCS.find((a) => a.id === state.arcId) ?? ARCS[0];
    const turnsOnBeat = state.turnsOnBeat + 1;
    if (turnsOnBeat >= CHAPTERS_PER_BEAT && state.beatIndex < arc.beats.length - 1) {
      return { ...state, beatIndex: state.beatIndex + 1, turnsOnBeat: 0 };
    }
    return { ...state, turnsOnBeat };
  },

  directive(state: PlotState): string {
    const arc = ARCS.find((a) => a.id === state.arcId);
    if (!arc) return '';
    const beat = arc.beats[Math.min(state.beatIndex, arc.beats.length - 1)];
    return `Advance the story's through-line ("${arc.name}"): ${beat}.`;
  },
};
