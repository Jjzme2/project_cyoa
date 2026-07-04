import { adminDb } from '../firebase-admin'
import { applyVote } from '../feedback'
import type { Feedback, FeedbackStatus, FeedbackType } from '@/types'

// ─── Community feedback ──────────────────────────────────────────────────────

const MAX_VOTERS = 5000

function feedbackCollection() {
  return adminDb.collection('feedback')
}

export interface FeedbackInput {
  type: FeedbackType
  title: string
  body: string
}

export async function createFeedback(input: FeedbackInput, authorId: string, authorName: string): Promise<string> {
  const now = new Date().toISOString()
  const ref = await feedbackCollection().add({
    type: input.type,
    title: input.title.slice(0, 140),
    body: input.body.slice(0, 4000),
    status: 'open' as FeedbackStatus,
    authorId,
    authorName: authorName.slice(0, 80),
    votes: 0,
    voters: [],
    createdAt: now,
    updatedAt: now,
  })
  return ref.id
}

/** Recent feedback (sorted for display by the caller via lib/feedback). */
export async function listFeedback(limit = 200): Promise<Feedback[]> {
  const snap = await feedbackCollection().orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Feedback))
}

export async function getFeedback(id: string): Promise<Feedback | null> {
  const doc = await feedbackCollection().doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Feedback
}

/** Toggle a user's upvote, transactionally. Returns the new count + state. */
export async function toggleFeedbackVote(id: string, uid: string): Promise<{ votes: number; voted: boolean }> {
  const ref = feedbackCollection().doc(id)
  return adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) throw new Error('Feedback not found')
    const voters: string[] = doc.data()?.voters ?? []
    if (voters.length >= MAX_VOTERS && !voters.includes(uid)) {
      return { votes: voters.length, voted: false }
    }
    const { voters: next, votes, voted } = applyVote(voters, uid)
    txn.update(ref, { voters: next, votes, updatedAt: new Date().toISOString() })
    return { votes, voted }
  })
}

export async function setFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  adminNote?: string,
  tier?: 0 | 1 | 2 | 3,
): Promise<void> {
  await feedbackCollection().doc(id).update({
    status,
    ...(adminNote !== undefined ? { adminNote: adminNote.slice(0, 500) } : {}),
    ...(tier !== undefined ? { tier } : {}),
    updatedAt: new Date().toISOString(),
  })
}
