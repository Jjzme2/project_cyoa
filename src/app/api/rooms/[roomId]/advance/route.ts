import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { advanceRoom } from '@/lib/rooms'

const AdvanceSchema = z.object({ toNodeId: z.string().min(1, 'toNodeId required') })

/** Advance the room to a path just written in-room at a frontier. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, AdvanceSchema)
  if (!parsed.ok) return parsed.response

  const result = await advanceRoom(roomId, parsed.data.toNodeId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
