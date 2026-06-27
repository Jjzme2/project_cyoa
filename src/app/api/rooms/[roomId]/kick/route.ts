import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { kickMember } from '@/lib/rooms'

const KickSchema = z.object({ targetUid: z.string().min(1, 'targetUid required') })

/** Host-only: remove a member from the room. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, KickSchema)
  if (!parsed.ok) return parsed.response

  const result = await kickMember(roomId, auth.uid, parsed.data.targetUid)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
