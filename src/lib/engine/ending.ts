import type { EngineState } from '@/types'

/** Never end before the story has had room to breathe. */
export const ENDING_MIN_DEPTH = 4
/** Past this depth, actively look for the exit so paths don't sprawl forever. */
const SOFT_TARGET_DEPTH = 12
/** PHASES index of 'Resolution' in the plot planner. */
const RESOLUTION_BEAT = 3

/**
 * Decide whether — and how strongly — to INVITE an ending this chapter, from the
 * engine state. Returns a directive string for the prompt, or '' to keep going.
 *
 * Deliberately conservative so endings stay rare and earned: only past a minimum
 * depth, and only when the plot through-line has resolved, the path has run long,
 * or tension spiked and then settled (a natural denouement). The model still
 * decides whether the moment truly lands — this only opens the door.
 */
export function endingDirective(
  depth: number,
  state: EngineState | undefined,
  mode: 'dramatic' | 'gentle' = 'dramatic',
): string {
  if (depth < ENDING_MIN_DEPTH) return ''
  const gentle = mode === 'gentle'

  const beatIndex = state?.plot?.beatIndex ?? 0
  if (beatIndex >= RESOLUTION_BEAT) {
    return gentle
      ? 'the story’s arc has found its fullness — bring it to a warm, satisfied close if this chapter can land it.'
      : 'the central through-line has reached its resolution — bring the story to a close if this chapter can land it.'
  }
  if (depth >= SOFT_TARGET_DEPTH) {
    return gentle
      ? 'this tale has wandered sweetly and long; watch for the contented moment to tuck it in.'
      : 'this path has run long; watch for the earned moment to bring it home.'
  }

  const tension = state?.director?.tension ?? 0
  const turnsSinceSpike = state?.director?.turnsSinceSpike ?? 0
  if (tension < 0.25 && turnsSinceSpike >= 3) {
    return gentle
      ? 'the day is winding down and every heart is full — this may be the natural place to close.'
      : 'the storm has passed and the tension has settled — this may be the natural place to close.'
  }

  return ''
}
