import { analytics } from './telemetry'

/**
 * Uniform observability for AI generation across the API routes.
 *
 * Every credit-spending generation path (assist, cover image, in-story chapter,
 * saga openings) emits one of two analytics events so we can answer, from the
 * telemetry rollups alone:
 *   - how many generations failed (count of `generation.failed`, by `reason`)
 *   - how much they cost (sum of `credits` on `generation.completed`, and the
 *     refunded `credits` on `generation.failed`)
 *   - which surfaces are flaky (group by `kind`)
 *
 * Fire-and-forget, exactly like the underlying telemetry: these never throw and
 * never block the response.
 */

/** Which generation surface produced the event. */
export type GenerationKind = 'assist' | 'cover' | 'chapter' | 'saga' | 'portrait' | 'sandbox'

/** Why a generation produced no usable content. */
export type GenerationFailureReason =
  | 'model_error' // the model/provider threw or timed out
  | 'prompt_rejected' // the model's own validation pass rejected or voided the prompt
  | 'refused' // moderation refused the generated content
  | 'image_failed' // text succeeded but the image generation returned nothing
  | 'empty' // the model returned nothing usable

export interface GenerationOutcome {
  kind: GenerationKind
  /** Credits charged (on completion) or refunded (on failure). */
  credits: number
  /** Where the credit was drawn from, when known. */
  source?: 'daily' | 'purchased'
  uid?: string | null
  /** Extra context (storyId, worldId, type, model, …) — kept shallow. */
  context?: Record<string, unknown>
}

/** Record a generation that produced usable content. */
export function trackGenerationCompleted(outcome: GenerationOutcome): void {
  void analytics.track('generation.completed', {
    uid: outcome.uid,
    props: { kind: outcome.kind, credits: outcome.credits, source: outcome.source, ...outcome.context },
  })
}

/**
 * Record a generation that did not produce usable content. `reason` categorizes
 * the failure (model error, safety refusal, editorial void, failed image …);
 * `credits` is the amount that was refunded so wasted spend stays measurable.
 */
export function trackGenerationFailed(
  outcome: GenerationOutcome & { reason: GenerationFailureReason },
): void {
  void analytics.track('generation.failed', {
    uid: outcome.uid,
    props: {
      kind: outcome.kind,
      credits: outcome.credits,
      source: outcome.source,
      reason: outcome.reason,
      ...outcome.context,
    },
  })
}
