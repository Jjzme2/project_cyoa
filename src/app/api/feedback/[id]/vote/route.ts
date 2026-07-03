import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import { toggleFeedbackVote } from '@/lib/firestore-helpers'

/** Toggle the signed-in user's upvote on a feedback item. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Sign in to vote' }, { status: 401 })

  // Abuse guard: voting is a toggle, nobody needs more than a few dozen a minute.
  if (!(await throttle(`fbvote:${auth.uid}`, 30, 60))) {
    return NextResponse.json({ error: 'Slow down a little.' }, { status: 429 })
  }

  const { id } = await params
  try {
    const result = await toggleFeedbackVote(id, auth.uid)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
  }
}
