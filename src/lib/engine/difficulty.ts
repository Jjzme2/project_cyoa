import type { NarrativeMode } from './narrative-mode';

/**
 * Dynamic difficulty. Stakes escalate with story depth (classic rising action)
 * and adapt to how the player has been faring, read from the Director's tension:
 * a long calm ramps the challenge up, a sustained high-tension stretch eases it
 * so the story stays tense but fair. Surfaced to the AI as a "Stakes:" directive
 * telling it how dangerous to make threats and obstacles.
 */

export interface DifficultyState {
  /** 0 (modest) .. 1 (dire). */
  level: number;
}

export const DifficultyManager = {
  update(depth: number, priorTension: number, prior?: DifficultyState): DifficultyState {
    const base = Math.min(0.8, depth * 0.05); // deeper into the story = higher stakes
    let target = base;
    if (priorTension > 0.7) target -= 0.15; // it's been brutal — ease off
    else if (priorTension < 0.3) target += 0.15; // it's been a cruise — ramp up
    target = Math.max(0.05, Math.min(1, target));

    const cur = prior?.level ?? base;
    const level = Math.round((cur + (target - cur) * 0.4) * 100) / 100; // ease toward target
    return { level };
  },

  /**
   * In a GENTLE world the same curve measures how much the moment MEANS, not how
   * dangerous it is — significance instead of peril. DARK reads it as moral/
   * physical cost; ABSURD as how far the nonsense has escalated.
   */
  directive(level: number, mode: NarrativeMode = 'dramatic'): string {
    if (mode === 'gentle') {
      if (level >= 0.66) return 'This moment matters deeply — let its emotional weight be felt: something long-awaited, dearly hoped-for, or quietly profound.';
      if (level >= 0.33) return 'The moment carries real meaning — let choices touch hearts and friendships in ways that matter.';
      return 'Keep things light and easeful — small pleasures, low ceremony.';
    }
    if (mode === 'dark') {
      if (level >= 0.66) return 'The cost is severe — let consequences be genuinely grim, irreversible, and morally costly.';
      if (level >= 0.33) return 'The stakes carry real weight — choices should cost something that cannot be undone.';
      return 'Even the small things carry a faint unease — nothing here is entirely safe.';
    }
    if (mode === 'absurd') {
      if (level >= 0.66) return 'The absurdity has reached its peak — let the illogic be total and gloriously over-the-top.';
      if (level >= 0.33) return 'The nonsense is escalating nicely — let obstacles be silly but strangely committed to their own internal logic.';
      return 'Keep the strangeness low-key for now — a faint wrongness, played completely straight.';
    }
    if (mode === 'melancholic') {
      if (level >= 0.66) return 'The ache runs deep — let this moment carry real grief, longing, or the full weight of what is gone.';
      if (level >= 0.33) return 'There is real wistfulness here — let feelings sit, unresolved, a little tender.';
      return 'Keep it soft and quiet for now — small, unremarked-upon feelings.';
    }
    if (mode === 'mystery') {
      if (level >= 0.66) return 'The truth is close now — let the clues converge and the stakes of knowing (or not) feel urgent.';
      if (level >= 0.33) return 'The trail is warming up — let clues connect in ways that raise real questions.';
      return 'Keep the mystery simmering quietly — small oddities, nothing urgent yet.';
    }
    if (mode === 'slice_of_life') {
      if (level >= 0.66) return 'This ordinary moment matters more than it looks — let it land with real, quiet significance.';
      if (level >= 0.33) return 'Let this moment carry a little more weight than usual, still small, still true.';
      return 'Keep this moment light and unremarkable — just life, ticking along.';
    }
    if (level >= 0.66) return 'The stakes are dire — make threats and obstacles genuinely dangerous and costly.';
    if (level >= 0.33) return 'The stakes are real — challenges should carry meaningful risk.';
    return 'The stakes are modest for now — keep dangers light.';
  },
};
