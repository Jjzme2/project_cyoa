import { FEEDBACK_STATUSES, FEEDBACK_TYPES, type Feedback, type FeedbackStatus, type FeedbackType } from '@/types'

/**
 * Pure feedback helpers — dependency-free so they run on server, client, and in
 * tests identically.
 */

export function isFeedbackType(v: unknown): v is FeedbackType {
  return typeof v === 'string' && (FEEDBACK_TYPES as readonly string[]).includes(v)
}

export function isFeedbackStatus(v: unknown): v is FeedbackStatus {
  return typeof v === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(v)
}

/** Toggle a voter in the list. Returns the new voters, count, and whether the
 * user now has an active vote. Pure. */
export function applyVote(
  voters: string[],
  uid: string,
): { voters: string[]; votes: number; voted: boolean } {
  const has = voters.includes(uid)
  const next = has ? voters.filter((v) => v !== uid) : [...voters, uid]
  return { voters: next, votes: next.length, voted: !has }
}

/**
 * Order feedback for the coding-agent export: by admin tier first (T0 → T3,
 * untriaged last), then community votes, then recency. Pure.
 */
export function sortForExport(items: Feedback[]): Feedback[] {
  return [...items].sort(
    (a, b) =>
      (a.tier ?? 99) - (b.tier ?? 99) ||
      b.votes - a.votes ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
}

/**
 * Order feedback for display: open items first (open > planned > in_progress),
 * then by votes, then by recency. Done/declined sink to the bottom. Pure.
 */
export function sortFeedback(items: Feedback[]): Feedback[] {
  const rank: Record<FeedbackStatus, number> = {
    open: 0,
    planned: 1,
    in_progress: 2,
    done: 4,
    declined: 5,
  }
  return [...items].sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      b.votes - a.votes ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
}
