import { NextRequest, NextResponse } from 'next/server'
import { pruneTelemetry } from '@/lib/telemetry-retention'

// Pruning can take a moment on a large backlog; give it room. (No runtime/dynamic
// exports — incompatible with cacheComponents; reading headers is already dynamic.)
export const maxDuration = 60

/**
 * Daily Vercel Cron (see vercel.json): delete raw telemetry events past the
 * retention window, keeping the daily rollups. Authorized by CRON_SECRET, which
 * Vercel sends as `Authorization: Bearer <CRON_SECRET>` on scheduled invocations.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/telemetry-retention] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await pruneTelemetry()
    const total = result.results.reduce((n, r) => n + r.deleted, 0)
    console.log(`[cron/telemetry-retention] pruned ${total} events older than ${result.cutoff}`)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/telemetry-retention] failed:', err)
    return NextResponse.json({ error: 'Retention run failed' }, { status: 500 })
  }
}
