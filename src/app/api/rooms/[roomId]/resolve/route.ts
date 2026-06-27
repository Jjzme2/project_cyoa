import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { resolveRound } from '@/lib/rooms'

const ResolveSchema = z.object({
  round: z.coerce.number().int({ message: 'round required' }),
  force: z.boolean().default(false),
})

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

  const parsed = await parseJson(req, ResolveSchema)
  if (!parsed.ok) return parsed.response
  const { round, force } = parsed.data

  const result = await resolveRound(roomId, round, { force, byUid: auth.uid })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
