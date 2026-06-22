import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { kickMember } from '@/lib/rooms'

/** Host-only: remove a member from the room. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const targetUid = typeof body.targetUid === 'string' ? body.targetUid : ''
  if (!targetUid) return NextResponse.json({ error: 'targetUid required' }, { status: 400 })

  const result = await kickMember(roomId, auth.uid, targetUid)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
