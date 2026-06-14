import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { castVote } from '@/lib/rooms'

/** Cast (or change) this member's vote for the current round. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const slotId = typeof body.slotId === 'string' ? body.slotId : ''
  const round = Number(body.round)
  if (!slotId || !Number.isInteger(round)) {
    return NextResponse.json({ error: 'slotId and round required' }, { status: 400 })
  }

  const result = await castVote(roomId, auth.uid, slotId, round)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
