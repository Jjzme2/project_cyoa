/**
 * A "Season" (live event) — the live-ops heartbeat. A time-boxed, themed
 * happening admins define and publish: a banner, a creative invitation, and a
 * window. It gives players a reason to return and a shared cultural moment
 * ("The Sundering — a crisis everyone writes into"), and gives the platform a
 * recurring marketing beat.
 *
 * Admin-authored; surfaced to players as a banner + event page while live.
 */
export interface Season {
  id: string
  /** Display name, e.g. "The Sundering". */
  name: string
  /** One-line hook shown on the banner. */
  tagline: string
  /** Longer description shown on the event page. */
  description: string
  /**
   * The creative invitation woven into the event — what writers are asked to
   * do this season (a prompt/mandate). Optional.
   */
  prompt?: string
  /** ISO datetime the event opens. */
  startsAt: string
  /** ISO datetime the event closes. */
  endsAt: string
  /** Banner accent colour (hex), defaults to house gold when unset. */
  accent?: string
  /** Staged events are hidden from players until published. */
  published: boolean
  /**
   * Self-sustaining live-ops: a recurring season's window rolls forward
   * automatically (daily cron) once it ends, so the heartbeat doesn't depend on
   * an operator remembering. Default: none (one-shot).
   */
  recurrence?: 'none' | 'monthly' | 'yearly'
  /**
   * Optional scope: limit the event to a named multiverse. Null/undefined means
   * site-wide.
   */
  multiverseId?: string | null
  multiverseName?: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}
