import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { heartbeat } from '@/lib/rooms'

/** Presence heartbeat — refreshes the member's lastSeen. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await heartbeat(roomId, auth.uid)
  return NextResponse.json({ ok: true })
}
