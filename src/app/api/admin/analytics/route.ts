import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getDailyBuckets } from '@/lib/telemetry'

/** Admin-only: per-day analytics rollups for the dashboard. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 14, 1), 90)
  const buckets = await getDailyBuckets('analytics', days)

  // Roll the per-day event tallies up into an all-time-in-window leaderboard.
  const totals: Record<string, number> = {}
  let grandTotal = 0
  for (const b of buckets) {
    grandTotal += b.total
    for (const [name, count] of Object.entries(b.events)) {
      totals[name] = (totals[name] ?? 0) + count
    }
  }
  const topEvents = Object.entries(totals)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({ days, grandTotal, topEvents, buckets })
}
