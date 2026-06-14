import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { leaveRoom } from '@/lib/rooms'

/** Leave a room. Promotes a new host if the host leaves; ends an empty room. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await leaveRoom(roomId, auth.uid)
  return NextResponse.json({ ok: true })
}
