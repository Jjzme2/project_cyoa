import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { resolveReading, resolveRound } from '@/lib/rooms'

const ResolveSchema = z.object({
  round: z.coerce.number().int({ message: 'round required' }),
  force: z.boolean().default(false),
})

/**
 * Resolve whichever phase the room is currently waiting on — the reading gate
 * or a voting round — and advance it. Idempotent (guarded by round number and
 * current status) so any client whose countdown expires can safely call it;
 * each resolver silently no-ops if the room isn't in its phase. `force: true`
 * lets the host skip the wait early.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, ResolveSchema)
  if (!parsed.ok) return parsed.response
  const { round, force } = parsed.data

  const readingResult = await resolveReading(roomId, round, { force, byUid: auth.uid })
  if (readingResult.error) return NextResponse.json({ error: readingResult.error }, { status: 400 })

  const result = await resolveRound(roomId, round, { force, byUid: auth.uid })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
