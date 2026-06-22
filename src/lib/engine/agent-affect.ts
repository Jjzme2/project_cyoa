/**
 * Affective layer: each character's mood, derived from their standing with the
 * protagonist (relationship graph) and the immediate threat level. Mood is a
 * lightweight emotion/FSM signal that colours the tone the AI writes a character
 * in — distinct from raw affinity, which drives *what* they pursue.
 */

export type Mood = 'content' | 'calm' | 'wary' | 'hostile' | 'desperate';

export interface AffectState {
  mood: Record<string, Mood>;
}

const TONE: Record<Mood, string> = {
  content: 'warm and at ease',
  calm: 'composed',
  wary: 'guarded and suspicious',
  hostile: 'openly hostile',
  desperate: 'desperate and on edge',
};

function moodFor(affinity: number, threatened: boolean, prior?: Mood): Mood {
  if (threatened) return 'desperate';
  // Hysteresis: a character who was hostile stays wary until clearly warmed,
  // so moods don't flip on tiny affinity wobbles (a small FSM dampening).
  if (affinity <= -0.5) return 'hostile';
  if (affinity < -0.15) return 'wary';
  if (affinity >= 0.5) return 'content';
  if (prior === 'hostile' && affinity < 0.1) return 'wary';
  return 'calm';
}

export const AgentAffect = {
  compute(
    names: string[],
    affinity: Record<string, number>,
    threatened: boolean,
    prior?: AffectState,
  ): AffectState {
    const mood: Record<string, Mood> = {};
    for (const n of names) {
      mood[n] = moodFor(affinity[n] ?? 0, threatened, prior?.mood[n]);
    }
    return { mood };
  },

  /** Prompt-ready description of characters whose demeanour is worth noting. */
  summary(state: AffectState): string {
    const notable = Object.entries(state.mood).filter(([, m]) => m !== 'calm');
    if (notable.length === 0) return '';
    return notable.map(([n, m]) => `${n} is ${TONE[m]}`).join('; ');
  },
};
