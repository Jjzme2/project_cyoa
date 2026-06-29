import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { createFeedback, listFeedback } from '@/lib/firestore-helpers'
import { sortFeedback } from '@/lib/feedback'
import { insights } from '@/lib/telemetry'
import { FEEDBACK_TYPES } from '@/types'

const FeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  title: z.string().trim().min(3, 'Give it a short title').max(140),
  body: z.string().trim().min(5, 'Add a little detail').max(4000),
})

/**
 * Public: the community feedback board. Returns items sorted for display, with
 * each item's vote count and whether the (optional) viewer has voted. Voter ids
 * are never exposed.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req).catch(() => null)
  const items = sortFeedback(await listFeedback())
  const board = items.map(({ voters, authorId, ...rest }) => ({
    ...rest,
    votedByMe: auth ? voters.includes(auth.uid) : false,
    isMine: auth ? authorId === auth.uid : false,
  }))
  return NextResponse.json({ feedback: board })
}

/** Submit a bug report, feature request, or piece of feedback. Sign-in required. */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Sign in to post feedback' }, { status: 401 })

  const parsed = await parseJson(req, FeedbackSchema)
  if (!parsed.ok) return parsed.response
  const { type, title, body } = parsed.data

  const id = await createFeedback({ type, title, body }, auth.uid, auth.name ?? 'Anonymous')
  await insights.track('feedback.created', { uid: auth.uid, props: { feedbackId: id, type } })

  return NextResponse.json({ id }, { status: 201 })
}
