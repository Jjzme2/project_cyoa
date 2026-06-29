import type { Season } from '@/types'

/**
 * Pure season-status logic, kept dependency-free so it can run on the server,
 * the client banner, and in unit tests identically.
 */

export type SeasonPhase = 'draft' | 'upcoming' | 'live' | 'ended'

/** Where a season sits relative to `now`. A draft (unpublished) is always 'draft'. */
export function seasonPhase(season: Pick<Season, 'startsAt' | 'endsAt' | 'published'>, now: Date): SeasonPhase {
  if (!season.published) return 'draft'
  const t = now.getTime()
  const start = Date.parse(season.startsAt)
  const end = Date.parse(season.endsAt)
  if (Number.isNaN(start) || Number.isNaN(end)) return 'draft'
  if (t < start) return 'upcoming'
  if (t > end) return 'ended'
  return 'live'
}

/** A published season whose window contains `now`. */
export function isSeasonLive(season: Pick<Season, 'startsAt' | 'endsAt' | 'published'>, now: Date): boolean {
  return seasonPhase(season, now) === 'live'
}

/**
 * Pick the single season to feature right now from a list: the live one ending
 * soonest (so a closing event gets the spotlight); if none are live, the next
 * upcoming one starting soonest. Returns null when nothing is live or upcoming.
 */
export function featuredSeason<T extends Pick<Season, 'startsAt' | 'endsAt' | 'published'>>(
  seasons: T[],
  now: Date,
): T | null {
  const live = seasons
    .filter((s) => seasonPhase(s, now) === 'live')
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
  if (live.length) return live[0]

  const upcoming = seasons
    .filter((s) => seasonPhase(s, now) === 'upcoming')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  return upcoming[0] ?? null
}

/**
 * Human countdown like "3d 4h left" / "starts in 2h" / "ended". Coarse by
 * design (days/hours/minutes) — it drives a banner, not a clock.
 */
export function countdownLabel(season: Pick<Season, 'startsAt' | 'endsAt' | 'published'>, now: Date): string {
  const phase = seasonPhase(season, now)
  if (phase === 'ended') return 'Ended'
  if (phase === 'draft') return 'Draft'
  const target = phase === 'upcoming' ? Date.parse(season.startsAt) : Date.parse(season.endsAt)
  const ms = target - now.getTime()
  const verb = phase === 'upcoming' ? 'Starts in ' : ''
  const suffix = phase === 'upcoming' ? '' : ' left'
  return verb + formatDuration(ms) + suffix
}

function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const minutes = mins % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
