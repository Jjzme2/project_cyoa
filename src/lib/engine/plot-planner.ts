import { SeededRNG } from './seed-rng';
import type { NarrativeMode } from './narrative-mode';

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
  /** A per-story AI-generated custom arc (credit-gated), overriding the curated pools entirely. */
  customArc?: { name: string; beats: string[] };
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

/**
 * DARK through-lines: heavier than the default dramatic pool — dread, moral
 * cost, and consequences that don't get undone. No guaranteed happy ending.
 */
const DARK_ARCS: PlotArc[] = [
  {
    id: 'creeping_corruption',
    name: 'Creeping Corruption',
    beats: [
      'let a small, easily-justified compromise take root, rotting something from within',
      'let the compromises accumulate, each one a little easier to justify than the last',
      'reveal exactly how deep the rot has gone — far further than anyone admitted',
      'force a choice between costs, with no clean way out',
    ],
  },
  {
    id: 'debt_collector',
    name: 'The Debt Collector',
    beats: [
      'surface an old debt or wrong that was never truly settled',
      'let the price being demanded for it grow crueler than expected',
      'strike a desperate bargain to satisfy it',
      'pay the bargain’s true cost in full, and let it hurt',
    ],
  },
  {
    id: 'last_good_thing',
    name: 'The Last Good Thing',
    beats: [
      'establish something precious, now threatened by encroaching ruin',
      'let every attempt to protect it cost more than it should',
      'lose it, or hollow it out, despite everything done to save it',
      'carry the grief of it forward, changed',
    ],
  },
  {
    id: 'mask_slips',
    name: 'The Mask Slips',
    beats: [
      'show the first hairline crack in someone deeply trusted',
      'let the crack widen despite every reassurance that all is well',
      'expose the true rot beneath the mask at the cruelest possible moment',
      'reckon with having to live alongside who they really are',
    ],
  },
];

/**
 * ABSURD through-lines: surreal, comedic escalation played with total deadpan
 * sincerity — the world is silly, nobody in it treats it that way.
 */
const ABSURD_ARCS: PlotArc[] = [
  {
    id: 'escalating_nonsense',
    name: 'Escalating Nonsense',
    beats: [
      'introduce a small oddity that everyone treats with total, straight-faced sincerity',
      'let the oddity compound — each development sillier than the last, taken completely seriously',
      'spiral the nonsense into full, glorious absurd chaos',
      'resolve it with an utterly unbothered, deadpan shrug',
    ],
  },
  {
    id: 'bureaucracy_of_the_bizarre',
    name: 'The Bureaucracy of the Bizarre',
    beats: [
      'introduce an inexplicable rule, form, or institution that intrudes on ordinary life',
      'demand ever-more-ridiculous compliance with it, played entirely straight',
      'reveal the rule’s absurd, self-defeating internal logic',
      'win not by fighting the nonsense but by embracing it completely',
    ],
  },
  {
    id: 'wrong_hero',
    name: 'The Wrong Hero',
    beats: [
      'have someone utterly unsuited mistaken for a legendary figure',
      'let the misunderstanding snowball as everyone commits harder to the bit',
      'nearly expose the truth at the worst, most public possible moment',
      'lean into the role anyway, absurdly, and have it somehow work',
    ],
  },
  {
    id: 'curse_of_mild_inconvenience',
    name: 'The Curse of Mild Inconvenience',
    beats: [
      'afflict the protagonist with a trivial, faintly ridiculous curse or mishap',
      'let it compound in increasingly silly, entirely harmless ways',
      'attempt an over-the-top ritual or "fix" for it',
      'have the fix produce an even sillier side effect everyone simply accepts',
    ],
  },
];

/**
 * MELANCHOLIC through-lines: quiet sorrow and bittersweet longing — memory,
 * distance, and things left unsaid or already lost. No danger required.
 */
const MELANCHOLIC_ARCS: PlotArc[] = [
  {
    id: 'the_one_that_got_away',
    name: 'The One That Got Away',
    beats: [
      'surface a small, wistful memory of someone or something once close, now distant',
      'let the ache of that distance surface in quiet, unguarded moments',
      'bring the protagonist face to face with what was lost, or who it was lost to',
      'let them carry the bittersweet weight of it forward, gently, unresolved',
    ],
  },
  {
    id: 'fading_light',
    name: 'Fading Light',
    beats: [
      'introduce something precious quietly nearing its end — a season, a friendship, a place',
      'let small, tender moments accumulate, each one a little more precious for being numbered',
      'reach the quiet goodbye, said or unsaid',
      'settle into what remains — memory, gratitude, a changed quiet',
    ],
  },
  {
    id: 'the_letter_never_sent',
    name: 'The Letter Never Sent',
    beats: [
      'reveal something left unsaid that still weighs on the protagonist',
      'let opportunities to finally say it come and slip away, gently, again',
      'force the moment where it must be said, or be lost for good',
      'live with the saying, or the silence, and what it costs either way',
    ],
  },
  {
    id: 'the_quiet_house',
    name: 'The Quiet House',
    beats: [
      'return the protagonist to a place thick with memory, changed by time',
      'let old memories surface unbidden among the small, ordinary details',
      'find the one object, room, or moment that holds everything',
      'leave the place changed by having remembered it fully',
    ],
  },
];

/**
 * MYSTERY through-lines: a puzzle to solve — concrete clues, red herrings,
 * and a truth the protagonist is chasing down.
 */
const MYSTERY_ARCS: PlotArc[] = [
  {
    id: 'the_loose_thread',
    name: 'The Loose Thread',
    beats: [
      'plant an inconsistency too small for most to notice, but not the protagonist',
      'let following it unravel more questions than it answers',
      'pull the thread to its end and expose the truth it was hiding',
      'reckon with what the truth changes now that it is known',
    ],
  },
  {
    id: 'the_locked_room',
    name: 'The Locked Room',
    beats: [
      'present an impossible situation with no apparent explanation',
      'gather clues that only seem to deepen the impossibility',
      'find the detail that makes the impossible make sense',
      'confront whoever — or whatever — the solution implicates',
    ],
  },
  {
    id: 'the_unreliable_witness',
    name: 'The Unreliable Witness',
    beats: [
      'introduce an account of events that does not quite add up',
      'gather a second, conflicting account that muddies the truth further',
      'find the detail that reveals who was lying, and why',
      'deal with the fallout of knowing who to trust now',
    ],
  },
  {
    id: 'the_paper_trail',
    name: 'The Paper Trail',
    beats: [
      "uncover a single overlooked document, ledger, or record that shouldn't exist",
      'trace it backward through hands that all deny knowing anything',
      'arrive at the person or truth it was always pointing to',
      'decide what to do with a truth someone worked hard to bury',
    ],
  },
];

/**
 * SLICE-OF-LIFE through-lines: ordinary and low-stakes — small routines,
 * minor frictions, and human-scale moments. Nothing ever looms.
 */
const SLICE_OF_LIFE_ARCS: PlotArc[] = [
  {
    id: 'an_ordinary_week',
    name: 'An Ordinary Week',
    beats: [
      'settle into the small routines and minor frictions of an ordinary stretch of days',
      'let one small errand or plan wind through everyday complications',
      'reach a small, human moment of the week — a meal, a chat, a mundane triumph',
      'close the week a little different for it, nothing dramatic, just true',
    ],
  },
  {
    id: 'the_new_routine',
    name: 'The New Routine',
    beats: [
      'drop the protagonist into an unfamiliar but ordinary rhythm — a new job, home, or habit',
      'let small awkwardnesses and discoveries shape how they settle in',
      'find the moment it starts to feel less new and more like theirs',
      'let the routine become simply life, quietly and without ceremony',
    ],
  },
  {
    id: 'small_repairs',
    name: 'Small Repairs',
    beats: [
      "notice something minor that's been quietly neglected — a relationship, a space, a habit",
      'make small, unglamorous efforts to tend to it',
      'hit a small, human snag that almost derails the effort',
      'let the mended thing sit a little better than before, unremarkably',
    ],
  },
  {
    id: 'the_visit',
    name: 'The Visit',
    beats: [
      "bring someone (family, an old friend) into the protagonist's ordinary orbit for a while",
      'fill the visit with small talk, old habits, and minor friction',
      'reach the one honest, unguarded conversation the visit was really about',
      'let the goodbye be ordinary too, and all the more meaningful for it',
    ],
  },
];

const ALL_ARCS = [...ARCS, ...GENTLE_ARCS, ...DARK_ARCS, ...ABSURD_ARCS, ...MELANCHOLIC_ARCS, ...MYSTERY_ARCS, ...SLICE_OF_LIFE_ARCS];
const GENTLE_IDS = new Set(GENTLE_ARCS.map((a) => a.id));
const DARK_IDS = new Set(DARK_ARCS.map((a) => a.id));
const ABSURD_IDS = new Set(ABSURD_ARCS.map((a) => a.id));
const MELANCHOLIC_IDS = new Set(MELANCHOLIC_ARCS.map((a) => a.id));
const MYSTERY_IDS = new Set(MYSTERY_ARCS.map((a) => a.id));
const SLICE_OF_LIFE_IDS = new Set(SLICE_OF_LIFE_ARCS.map((a) => a.id));

/** The arc's own family pool, for chaining into a fresh movement of the same kind. */
function familyOf(arcId: string): PlotArc[] {
  if (GENTLE_IDS.has(arcId)) return GENTLE_ARCS;
  if (DARK_IDS.has(arcId)) return DARK_ARCS;
  if (ABSURD_IDS.has(arcId)) return ABSURD_ARCS;
  if (MELANCHOLIC_IDS.has(arcId)) return MELANCHOLIC_ARCS;
  if (MYSTERY_IDS.has(arcId)) return MYSTERY_ARCS;
  if (SLICE_OF_LIFE_IDS.has(arcId)) return SLICE_OF_LIFE_ARCS;
  return ARCS;
}

const CHAPTERS_PER_BEAT = 2;

export const PlotPlanner = {
  init(
    storyTitle: string,
    prior?: PlotState,
    persona?: { darkness?: number },
    mode: NarrativeMode = 'dramatic',
    customArc?: { name: string; beats: string[] },
  ): PlotState {
    if (prior) return prior;
    if (mode === 'custom' && customArc && customArc.beats.length > 0) {
      return { arcId: 'custom', beatIndex: 0, turnsOnBeat: 0, arcsCompleted: 0, customArc };
    }
    // A gentle/dark/absurd/melancholic/mystery/slice-of-life world draws only
    // from its own curated pool; a dramatic one keeps the traditional pool,
    // leaned by the director's darkness (dark steers away from the heroic
    // alliance arc; warm steers toward it).
    let pool: PlotArc[];
    if (mode === 'gentle') pool = GENTLE_ARCS;
    else if (mode === 'dark') pool = DARK_ARCS;
    else if (mode === 'absurd') pool = ABSURD_ARCS;
    else if (mode === 'melancholic') pool = MELANCHOLIC_ARCS;
    else if (mode === 'mystery') pool = MYSTERY_ARCS;
    else if (mode === 'slice_of_life') pool = SLICE_OF_LIFE_ARCS;
    else {
      const dark = persona?.darkness ?? 0;
      pool = ARCS;
      if (dark > 0.3) pool = ARCS.filter((a) => a.id !== 'forge_and_test');
      else if (dark < -0.3) pool = ARCS.filter((a) => a.id === 'forge_and_test');
    }
    const arc = pool[SeededRNG.hashString(storyTitle) % pool.length];
    return { arcId: arc.id, beatIndex: 0, turnsOnBeat: 0, arcsCompleted: 0 };
  },

  advance(state: PlotState): PlotState {
    const arcsCompleted = state.arcsCompleted ?? 0;
    const turnsOnBeat = state.turnsOnBeat + 1;

    if (state.customArc) {
      if (turnsOnBeat >= CHAPTERS_PER_BEAT) {
        if (state.beatIndex < state.customArc.beats.length - 1) {
          return { ...state, beatIndex: state.beatIndex + 1, turnsOnBeat: 0, arcsCompleted };
        }
        // A custom arc has no siblings to chain into — replay it as a fresh movement.
        return { ...state, beatIndex: 0, turnsOnBeat: 0, arcsCompleted: arcsCompleted + 1 };
      }
      return { ...state, turnsOnBeat, arcsCompleted };
    }

    const arc = ALL_ARCS.find((a) => a.id === state.arcId) ?? ARCS[0];

    if (turnsOnBeat >= CHAPTERS_PER_BEAT) {
      if (state.beatIndex < arc.beats.length - 1) {
        return { ...state, beatIndex: state.beatIndex + 1, turnsOnBeat: 0, arcsCompleted };
      }
      // The arc has resolved. Rather than plateau on the final beat (which made
      // long stories stall), chain into a fresh through-line — a new movement —
      // deterministically chosen so it differs from the one that just ended.
      // Chaining stays within the arc's own family (gentle/dark/absurd/dramatic
      // never drift into one another).
      const family = familyOf(arc.id);
      const others = family.filter((a) => a.id !== arc.id);
      const next = others[(arcsCompleted + SeededRNG.hashString(arc.id)) % others.length];
      return { arcId: next.id, beatIndex: 0, turnsOnBeat: 0, arcsCompleted: arcsCompleted + 1 };
    }
    return { ...state, turnsOnBeat, arcsCompleted };
  },

  directive(state: PlotState): string {
    if (state.customArc) {
      const i = Math.min(state.beatIndex, state.customArc.beats.length - 1);
      const beat = state.customArc.beats[i];
      const phase = PHASES[Math.min(i, PHASES.length - 1)];
      const movement = (state.arcsCompleted ?? 0) > 0 ? ` (movement ${(state.arcsCompleted ?? 0) + 1})` : '';
      return `Story through-line${movement} — "${state.customArc.name}", ${phase}: ${beat}.`;
    }
    const arc = ALL_ARCS.find((a) => a.id === state.arcId);
    if (!arc) return '';
    const i = Math.min(state.beatIndex, arc.beats.length - 1);
    const beat = arc.beats[i];
    const phase = PHASES[Math.min(i, PHASES.length - 1)];
    const movement = (state.arcsCompleted ?? 0) > 0 ? ` (movement ${(state.arcsCompleted ?? 0) + 1})` : '';
    return `Story through-line${movement} — "${arc.name}", ${phase}: ${beat}.`;
  },
};
