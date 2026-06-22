import { seededPersonality } from './agent-manager';
import type { PersonalityWeights } from '@/types/goap';

/**
 * Relationship graph + gossip propagation.
 *
 * Tracks each character's affinity toward the protagonist (-1 hostile .. +1
 * devoted). When one character's standing shifts — because of how they acted or
 * how the protagonist treated them — a fraction ripples to the rest of the cast,
 * weighted by how kindred they are: like-minded characters take the subject's
 * side, opposites drift the other way. Reputation becomes systemic rather than
 * per-scene: betray one ally and their friends grow wary even if you never met
 * them.
 */

export interface RelationshipState {
  /** character name → affinity toward the protagonist, -1..1. */
  affinity: Record<string, number>;
}

const GOSSIP_FACTOR = 0.4;

function clamp(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

/** A character's baseline lean toward the protagonist, from temperament. */
function baseline(p: PersonalityWeights): number {
  return clamp(
    (p.loyalty - 0.5) * 1.2 +
      (p.courage - 0.5) * 0.3 -
      (p.cunning - 0.5) * 0.4 -
      (p.greed - 0.5) * 0.4,
  );
}

/** Social closeness from temperament similarity (0 distant .. 1 kindred). */
function bond(a: PersonalityWeights, b: PersonalityWeights): number {
  const d =
    Math.abs(a.aggression - b.aggression) +
    Math.abs(a.loyalty - b.loyalty) +
    Math.abs(a.cunning - b.cunning) +
    Math.abs(a.greed - b.greed);
  return Math.max(0, 1 - d / 4);
}

export const RelationshipGraph = {
  /** Seed any unknown characters' baseline affinity; preserve prior values. */
  init(names: string[], prior?: RelationshipState): RelationshipState {
    const affinity: Record<string, number> = { ...(prior?.affinity ?? {}) };
    for (const n of names) {
      if (affinity[n] === undefined) {
        affinity[n] = Math.round(baseline(seededPersonality(n)) * 100) / 100;
      }
    }
    return { affinity };
  },

  /**
   * Shift `subject`'s affinity by `delta`, then ripple a fraction to everyone
   * else in proportion to how kindred they are (gossip). Kindred characters
   * (closeness > 0.5) move the same way; distant ones move slightly opposite.
   */
  applyEvent(state: RelationshipState, subject: string, delta: number, names: string[]): void {
    state.affinity[subject] = clamp((state.affinity[subject] ?? 0) + delta);
    const ps = seededPersonality(subject);
    for (const other of names) {
      if (other === subject) continue;
      const closeness = bond(ps, seededPersonality(other));
      const ripple = delta * GOSSIP_FACTOR * (closeness - 0.5) * 2;
      state.affinity[other] = clamp((state.affinity[other] ?? 0) + ripple);
    }
  },

  /** A prompt-ready line describing who stands where with the protagonist. */
  summary(state: RelationshipState): string {
    const entries = Object.entries(state.affinity);
    const warm = entries.filter(([, v]) => v > 0.3).map(([n]) => n);
    const cold = entries.filter(([, v]) => v < -0.3).map(([n]) => n);
    const parts: string[] = [];
    if (warm.length) parts.push(`${warm.join(', ')} ${warm.length === 1 ? 'is' : 'are'} warm toward the protagonist`);
    if (cold.length) parts.push(`${cold.join(', ')} ${cold.length === 1 ? 'has' : 'have'} grown cold or hostile`);
    return parts.join('; ');
  },
};
