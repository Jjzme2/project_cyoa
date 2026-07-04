import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { markReady } from '@/lib/rooms'

const ReadySchema = z.object({ round: z.coerce.number().int() })

/** Acknowledge the current chapter as read (the "ready" gate before voting/writing). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, ReadySchema)
  if (!parsed.ok) return parsed.response
  const { round } = parsed.data

  const result = await markReady(roomId, auth.uid, round)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
