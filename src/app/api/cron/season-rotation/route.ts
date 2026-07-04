import { NextRequest, NextResponse } from 'next/server'
import { rotateExpiredSeasons } from '@/lib/firestore-helpers'

/**
 * Daily Vercel Cron (see vercel.json): roll every ended, recurring season's
 * window forward so the live-ops heartbeat sustains itself — no operator needs
 * to remember. Authorized by CRON_SECRET, sent by Vercel as a Bearer token.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/season-rotation] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rolled = await rotateExpiredSeasons()
    if (rolled.length) console.log(`[cron/season-rotation] rolled ${rolled.length} season(s): ${rolled.join(', ')}`)
    return NextResponse.json({ ok: true, rolled })
  } catch (err) {
    console.error('[cron/season-rotation] failed:', err)
    return NextResponse.json({ error: 'Rotation run failed' }, { status: 500 })
  }
}
