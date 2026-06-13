import type { ContentRating } from '@/types'

/**
 * Age gating + content-rating policy.
 *
 * Chronicle is not directed to children under 13. Age is self-reported (real
 * verification isn't possible without ID / a third-party service), collected as
 * a date of birth plus an explicit confirmation. These helpers translate an
 * age into the highest content rating a viewer may see.
 */

export const MIN_SITE_AGE = 13
export const MATURE_MIN_AGE = 18

// Higher rank = more restricted.
export const RATING_RANK: Record<ContentRating, number> = {
  Everyone: 0,
  Teen: 1,
  Mature: 2,
}

export function ratingRank(rating: ContentRating | undefined | null): number {
  return rating ? RATING_RANK[rating] ?? 0 : 0
}

/** Whole years between `dob` (ISO YYYY-MM-DD) and now, or null if unparseable. */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

/**
 * Highest content rank a viewer of the given age may see:
 *  - null (no DOB on file) → Everyone only (rank 0)
 *  - under 13              → blocked (-1); not permitted to use the site
 *  - 13–17                 → Teen (rank 1)
 *  - 18+                   → Mature (rank 2)
 */
export function allowedRankForAge(age: number | null): number {
  if (age === null) return RATING_RANK.Everyone
  if (age < MIN_SITE_AGE) return -1
  if (age < MATURE_MIN_AGE) return RATING_RANK.Teen
  return RATING_RANK.Mature
}

export function canView(rating: ContentRating | undefined, allowedRank: number): boolean {
  return ratingRank(rating) <= allowedRank
}

/** Clamp a requested rating down to a ceiling (e.g. a story to its world). */
export function clampRating(requested: ContentRating, ceiling: ContentRating): ContentRating {
  return ratingRank(requested) > ratingRank(ceiling) ? ceiling : requested
}
