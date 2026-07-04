/**
 * Drama Manager / AI Director.
 *
 * Tracks a tension level across the story and decides a pacing "beat" each turn
 * — escalate when things have been calm too long, grant respite when tension is
 * high, otherwise build. The beat both modulates the procedural generators
 * (force/suppress encounters) and is surfaced to the AI as an explicit pacing
 * instruction, so the story breathes instead of staying flat or relentless.
 */

export interface DirectorState {
  /** 0 (calm) .. 1 (peak tension). */
  tension: number
  turnsSinceSpike: number
}

export type Beat = 'escalate' | 'build' | 'respite'

export interface DirectorSignals {
  encounter: boolean
  factionConflict: boolean
  hostileNpc: boolean
  combat: boolean
}

export class DramaManager {
  static readonly INITIAL: DirectorState = { tension: 0.2, turnsSinceSpike: 0 }

  /** Decide the beat from the tension carried into this turn. */
  decideBeat(prior: DirectorState): Beat {
    if (prior.tension > 0.75) return 'respite'
    if (prior.tension < 0.3 && prior.turnsSinceSpike >= 2) return 'escalate'
    return 'build'
  }

  /** Fold this turn's events (and the chosen beat) into the next tension level. */
  update(prior: DirectorState, beat: Beat, s: DirectorSignals): DirectorState {
    let t = prior.tension * 0.85 // natural decay toward calm
    if (s.encounter) t += 0.25
    if (s.factionConflict) t += 0.12
    if (s.hostileNpc) t += 0.2
    if (s.combat) t += 0.3
    if (beat === 'escalate') t += 0.2
    if (beat === 'respite') t -= 0.15
    t = Math.max(0, Math.min(1, t))

    const spiked = beat === 'escalate' || s.combat || t - prior.tension > 0.2
    return {
      tension: Math.round(t * 100) / 100,
      turnsSinceSpike: spiked ? 0 : prior.turnsSinceSpike + 1,
    }
  }

  /**
   * The pacing instruction handed to the AI for this beat. In a GENTLE world the
   * same curve drives anticipation instead of danger: an "escalation" is a
   * delightful new development, a "respite" a savoring pause. DARK leans the
   * same curve toward dread and cost; ABSURD toward compounding nonsense.
   */
  directive(beat: Beat, mode: 'dramatic' | 'gentle' | 'dark' | 'absurd' | 'custom' = 'dramatic'): string {
    if (mode === 'gentle') {
      switch (beat) {
        case 'escalate':
          return 'The story has been drifting — stir it gently: introduce a delightful arrival, invitation, or small wonder that draws everyone into motion.'
        case 'respite':
          return 'Anticipation has crested — allow a soft, savoring pause: a shared quiet, a warm exchange, a breath before the moment arrives.'
        default:
          return 'Keep the warm momentum, letting the present moment deepen toward the next inviting choice.'
      }
    }
    if (mode === 'dark') {
      switch (beat) {
        case 'escalate':
          return 'The dread has been building quietly — let it surface: a fresh sign of rot, a threat that can no longer be ignored, a price about to come due.'
        case 'respite':
          return 'The horror has crested — allow a grim, uneasy lull: a breath before the next blow, offering no real comfort.'
        default:
          return 'Let the weight settle further, the story sinking deeper into its own consequences.'
      }
    }
    if (mode === 'absurd') {
      switch (beat) {
        case 'escalate':
          return 'Things have been too sensible — throw in a fresh absurdity: a new rule, character, or coincidence that makes no sense and everyone treats as completely normal.'
        case 'respite':
          return 'The nonsense has peaked — allow a deadpan pause where everyone acts as if nothing strange happened at all.'
        default:
          return 'Keep compounding the absurdity, one straight-faced escalation at a time.'
      }
    }
    switch (beat) {
      case 'escalate':
        return 'The story has been calm — raise the stakes now: introduce a complication, threat, or turn that demands action.'
      case 'respite':
        return 'Tension is high — grant a brief, earned moment of respite or reflection before the next blow.'
      default:
        return 'Maintain steady momentum, deepening the present situation toward the next decision.'
    }
  }
}
