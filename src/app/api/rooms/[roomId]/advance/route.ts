import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { advanceRoom } from '@/lib/rooms'

/** Advance the room to a path just written in-room at a frontier. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const toNodeId = typeof body.toNodeId === 'string' ? body.toNodeId : ''
  if (!toNodeId) return NextResponse.json({ error: 'toNodeId required' }, { status: 400 })

  const result = await advanceRoom(roomId, toNodeId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
