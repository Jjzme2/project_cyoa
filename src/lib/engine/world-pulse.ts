import type { WorldPulse } from '@/types'

/**
 * Build the reader-facing simulation snapshot from the engine's already-computed
 * narrative context + state. Pure; kept dependency-free (loose param shapes) so
 * it's testable and never pulls the heavy engine classes into a bundle.
 *
 * Empty fields are omitted so the panel only shows what the world actually has
 * to say this chapter.
 */
export function buildWorldPulse(
  ctx: { factionStatus?: string; economySummary?: string; relationshipSummary?: string },
  state: { director?: { tension?: number } } | undefined,
): WorldPulse {
  const trim = (s?: string) => {
    const t = (s ?? '').trim()
    return t ? t : undefined
  }
  return {
    tension: Math.max(0, Math.min(1, state?.director?.tension ?? 0)),
    ...(trim(ctx.factionStatus) ? { factions: trim(ctx.factionStatus) } : {}),
    ...(trim(ctx.economySummary) ? { economy: trim(ctx.economySummary) } : {}),
    ...(trim(ctx.relationshipSummary) ? { cast: trim(ctx.relationshipSummary) } : {}),
  }
}

/** A short label for a tension level (0..1), for the meter. */
export function tensionLabel(t: number): string {
  if (t >= 0.75) return 'At a knife’s edge'
  if (t >= 0.5) return 'Tense'
  if (t >= 0.3) return 'Stirring'
  return 'Calm'
}

/** Whether a pulse has anything worth showing. */
export function hasPulse(p: WorldPulse | undefined): p is WorldPulse {
  return !!p && (p.tension > 0 || !!p.factions || !!p.economy || !!p.cast)
}
