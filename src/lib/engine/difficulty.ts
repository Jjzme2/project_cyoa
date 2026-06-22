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

  directive(level: number): string {
    if (level >= 0.66) return 'The stakes are dire — make threats and obstacles genuinely dangerous and costly.';
    if (level >= 0.33) return 'The stakes are real — challenges should carry meaningful risk.';
    return 'The stakes are modest for now — keep dangers light.';
  },
};
