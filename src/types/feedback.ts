/**
 * Community feedback — bug reports, feature requests, and general feedback the
 * community submits and upvotes to help steer the site.
 */

export const FEEDBACK_TYPES = ['bug', 'feature', 'feedback'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_STATUSES = ['open', 'planned', 'in_progress', 'done', 'declined'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export interface Feedback {
  id: string
  type: FeedbackType
  title: string
  body: string
  /** Triage state, set by admins. */
  status: FeedbackStatus
  authorId: string
  authorName: string
  /** Denormalized upvote count. */
  votes: number
  /** uids who upvoted (bounded; fine at community scale). */
  voters: string[]
  /** Optional admin note attached to a status change. */
  adminNote?: string
  /** Admin priority tier: 0 (do first) … 3 (someday). Unset = untriaged. */
  tier?: 0 | 1 | 2 | 3
  createdAt: string
  updatedAt: string
}
