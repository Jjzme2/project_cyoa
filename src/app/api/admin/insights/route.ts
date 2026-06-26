import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getRecentEvents } from '@/lib/telemetry'

/** Admin-only: the recent insights feed (notable signals, newest first). */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 50, 1), 200)
  const events = await getRecentEvents('insights', limit)
  return NextResponse.json({ events })
}
