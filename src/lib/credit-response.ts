import { NextResponse } from 'next/server'

export interface CreditFailure {
  /** True when the failure was a degraded rate limiter, not a real shortfall. */
  degraded?: boolean
  reset: number
}

const DEGRADED_MESSAGE =
  'AI generation is temporarily unavailable — please try again in a moment.'

/**
 * Standard response for a failed credit consumption. Distinguishes a genuine
 * "out of credits" (429, with the caller's message) from the rate limiter being
 * temporarily down (503) — so users aren't told to buy credits during an outage.
 */
export function creditFailureResponse(
  credit: CreditFailure,
  opts: { insufficientMessage?: string; extra?: Record<string, unknown> } = {},
): NextResponse {
  if (credit.degraded) {
    return NextResponse.json(
      { error: DEGRADED_MESSAGE, degraded: true, reset: credit.reset, ...opts.extra },
      { status: 503, headers: { 'Retry-After': '30' } },
    )
  }
  const retryAfter = Math.max(1, Math.ceil((credit.reset - Date.now()) / 1000))
  return NextResponse.json(
    { error: opts.insufficientMessage ?? 'Insufficient credits', reset: credit.reset, ...opts.extra },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}
