import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { deleteSeason } from '@/lib/firestore-helpers'
import { insights } from '@/lib/telemetry'

/** Admin-only: permanently delete a season. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await deleteSeason(id)
  await insights.track('season.deleted', { uid: auth.uid, props: { seasonId: id } })

  return NextResponse.json({ ok: true })
}
