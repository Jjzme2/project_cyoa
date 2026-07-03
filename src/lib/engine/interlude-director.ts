import { SeededRNG } from './seed-rng';

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

export const InterludeDirector = {
  decide(opts: {
    nodePath: string;
    turnCount: number;
    lastInterlude?: number;
    plotBeatIndex: number;
    betrayalThisTurn: boolean;
    mode?: 'dramatic' | 'gentle';
  }): InterludeDecision {
    const since = opts.turnCount - (opts.lastInterlude ?? -COOLDOWN - 1);
    if (since <= COOLDOWN) return { fired: false, directive: '' };

    const rng = new SeededRNG(SeededRNG.hashString(`${opts.nodePath}_interlude`));
    let kind: InterludeKind | null = null;
    if (opts.betrayalThisTurn) kind = 'flashback';
    else if (opts.plotBeatIndex === 2) kind = 'vision'; // the plot's revelation beat
    else if (rng.nextFloat() < 0.12) kind = 'dream';

    if (!kind) return { fired: false, directive: '' };
    const table = opts.mode === 'gentle' ? GENTLE_DIRECTIVE : DIRECTIVE;
    return { fired: true, directive: table[kind] };
  },
};
