import { SeededRNG } from './seed-rng';
import type { NarrativeMode } from './narrative-mode';

/**
 * Interlude director. Occasionally breaks the linear march with a non-linear
 * chapter — a flashback, a revealing vision, or a symbolic dream — driven by the
 * story's state: a betrayal earns an aching flashback, the plot's revelation beat
 * earns a vision, and now and then a spontaneous dream surfaces. A cooldown keeps
 * them rare so they land.
 */

export type InterludeKind = 'flashback' | 'vision' | 'dream';

export interface InterludeDecision {
  fired: boolean;
  directive: string;
}

const COOLDOWN = 3; // chapters between interludes

const DIRECTIVE: Record<InterludeKind, string> = {
  flashback:
    'Open this chapter as a vivid FLASHBACK to an earlier, warmer moment with a character who has since turned — let it ache against the present, then return to the now and the pending choice.',
  vision:
    'Frame this chapter as a sudden, disorienting VISION that reveals a hidden truth about what is really happening, then surface back to the present at a moment of decision.',
  dream:
    'Open with a short, symbolic DREAM the protagonist is having — charged with the story’s mood and a half-buried fear or hope — then have them wake into the present scene.',
};

/** Conflict-free interludes for GENTLE worlds — reverie instead of unease. */
const GENTLE_DIRECTIVE: Record<InterludeKind, string> = {
  flashback:
    'Open this chapter as a warm FLASHBACK to a treasured earlier moment — let its glow colour the present, then return to the now and the pending choice.',
  vision:
    'Frame this chapter as a bright, imaginative REVERIE — a luminous glimpse of the wonderful thing taking shape — then surface back to the present at a moment of delighted decision.',
  dream:
    'Open with a short, sweet DREAM the protagonist is having — coloured by the story’s warmth and a cherished hope — then have them wake gently into the present scene.',
};

/** Heavier interludes for DARK worlds — grim memory, unsettling revelation, nightmare. */
const DARK_DIRECTIVE: Record<InterludeKind, string> = {
  flashback:
    'Open this chapter as a grim FLASHBACK to the moment things first started going wrong — let it colour the present with dread, then return to the now and the pending choice.',
  vision:
    'Frame this chapter as an unsettling VISION that reveals a hidden, uncomfortable truth about what is really happening, then surface back to the present at a moment of costly decision.',
  dream:
    'Open with a short, nightmare-tinged DREAM the protagonist is having — charged with a half-buried fear or guilt — then have them wake into the present scene, shaken.',
};

/** Deadpan-surreal interludes for ABSURD worlds — treated with total sincerity. */
const ABSURD_DIRECTIVE: Record<InterludeKind, string> = {
  flashback:
    'Open this chapter as an oddly specific FLASHBACK to a completely mundane memory, narrated with wildly disproportionate solemnity — then return to the now and the pending choice.',
  vision:
    'Frame this chapter as a bizarre, bureaucratic VISION — an absurd glimpse of some nonsensical process or rule — narrated with total sincerity, then surface back to the present at a moment of decision.',
  dream:
    'Open with a short, deadpan-bizarre DREAM the protagonist is having, treated as perfectly ordinary — then have them wake into the present scene, unbothered.',
};

/** Wistful interludes for MELANCHOLIC worlds — memory, longing, absence. */
const MELANCHOLIC_DIRECTIVE: Record<InterludeKind, string> = {
  flashback:
    'Open this chapter as a tender FLASHBACK to a moment now lost to time or distance — let its warmth ache against the present, then return to the now and the pending choice.',
  vision:
    'Frame this chapter as a wistful REVERIE — a half-imagined glimpse of what might have been, or what once was — then surface back to the present at a quiet moment of decision.',
  dream:
    'Open with a short, bittersweet DREAM the protagonist is having — coloured by longing for someone or something gone — then have them wake softly into the present scene.',
};

/** Clue-laden interludes for MYSTERY worlds — a new angle on the puzzle. */
const MYSTERY_DIRECTIVE: Record<InterludeKind, string> = {
  flashback:
    'Open this chapter as a FLASHBACK that replays an earlier moment in a new light — a detail once missed now impossible to ignore — then return to the now and the pending choice.',
  vision:
    'Frame this chapter as a sudden flash of INSIGHT — pieces of the puzzle briefly aligning into a shape not yet provable — then surface back to the present at a moment of decision.',
  dream:
    'Open with a short, clue-laden DREAM the protagonist is having, images and half-heard words from the case tangled together — then have them wake with a half-formed idea.',
};

/** Ordinary, low-key interludes for SLICE-OF-LIFE worlds. */
const SLICE_OF_LIFE_DIRECTIVE: Record<InterludeKind, string> = {
  flashback:
    'Open this chapter as a small, fond FLASHBACK to an ordinary earlier moment — nothing dramatic, just a memory surfacing — then return to the now and the pending choice.',
  vision:
    'Frame this chapter as a brief daydream or imagined "what if" about an ordinary alternative — then surface back to the present at a small moment of decision.',
  dream:
    'Open with a short, ordinary DREAM the protagonist is having — mundane and a little strange the way real dreams are — then have them wake into the present scene.',
};

export const InterludeDirector = {
  decide(opts: {
    nodePath: string;
    turnCount: number;
    lastInterlude?: number;
    plotBeatIndex: number;
    betrayalThisTurn: boolean;
    mode?: NarrativeMode;
  }): InterludeDecision {
    const since = opts.turnCount - (opts.lastInterlude ?? -COOLDOWN - 1);
    if (since <= COOLDOWN) return { fired: false, directive: '' };

    const rng = new SeededRNG(SeededRNG.hashString(`${opts.nodePath}_interlude`));
    let kind: InterludeKind | null = null;
    if (opts.betrayalThisTurn) kind = 'flashback';
    else if (opts.plotBeatIndex === 2) kind = 'vision'; // the plot's revelation beat
    else if (rng.nextFloat() < 0.12) kind = 'dream';

    if (!kind) return { fired: false, directive: '' };
    const table =
      opts.mode === 'gentle' ? GENTLE_DIRECTIVE :
      opts.mode === 'dark' ? DARK_DIRECTIVE :
      opts.mode === 'absurd' ? ABSURD_DIRECTIVE :
      opts.mode === 'melancholic' ? MELANCHOLIC_DIRECTIVE :
      opts.mode === 'mystery' ? MYSTERY_DIRECTIVE :
      opts.mode === 'slice_of_life' ? SLICE_OF_LIFE_DIRECTIVE :
      DIRECTIVE;
    return { fired: true, directive: table[kind] };
  },
};
