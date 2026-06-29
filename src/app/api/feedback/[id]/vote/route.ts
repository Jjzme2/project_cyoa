import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { toggleFeedbackVote } from '@/lib/firestore-helpers'

/** Toggle the signed-in user's upvote on a feedback item. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Sign in to vote' }, { status: 401 })

  const { id } = await params
  try {
    const result = await toggleFeedbackVote(id, auth.uid)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
  }
}
