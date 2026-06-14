import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { resolveRound } from '@/lib/rooms'

/**
 * Resolve the current voting round and advance to the winning path. Idempotent
 * (guarded by round number) so any client whose countdown expires can call it.
 * `force: true` lets the host skip the timer.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const round = Number(body.round)
  if (!Number.isInteger(round)) {
    return NextResponse.json({ error: 'round required' }, { status: 400 })
  }
  const force = body.force === true

  const result = await resolveRound(roomId, round, { force, byUid: auth.uid })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
