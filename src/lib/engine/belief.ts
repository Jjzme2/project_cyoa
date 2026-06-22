import { seededPersonality } from './agent-manager';

/**
 * NPC belief model. Characters aren't omniscient: they act on a *perceived*
 * standing toward the protagonist that lags the true standing (relationship
 * graph). So a shift — including gossip that just reached them — changes their
 * behaviour gradually, and the cunning update their read faster than the naive.
 * This is what lets a character be briefly deceived or caught off guard.
 */

export interface BeliefState {
  /** Each character's perceived affinity toward the protagonist (-1..1). */
  perceived: Record<string, number>;
}

export const BeliefModel = {
  update(names: string[], trueAffinity: Record<string, number>, prior?: BeliefState): BeliefState {
    const perceived: Record<string, number> = { ...(prior?.perceived ?? {}) };
    for (const n of names) {
      const truth = trueAffinity[n] ?? 0;
      if (perceived[n] === undefined) {
        perceived[n] = truth; // first sight: no lag
        continue;
      }
      // The cunning read people fast; the naive lag well behind the truth.
      const rate = 0.3 + seededPersonality(n).cunning * 0.5;
      perceived[n] = Math.round((perceived[n] + (truth - perceived[n]) * rate) * 100) / 100;
    }
    return { perceived };
  },
};
