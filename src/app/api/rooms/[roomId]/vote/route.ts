import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { castVote } from '@/lib/rooms'

const VoteSchema = z.object({
  slotId: z.string().min(1),
  round: z.coerce.number().int(),
})

/** Cast (or change) this member's vote for the current round. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, VoteSchema)
  if (!parsed.ok) return parsed.response
  const { slotId, round } = parsed.data

  const result = await castVote(roomId, auth.uid, slotId, round)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
