import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { analytics, insights } from '@/lib/telemetry'

// Invalid/missing channels fall back to analytics, matching the prior behavior.
const TrackSchema = z.object({
  channel: z.enum(['analytics', 'insights']).catch('analytics').default('analytics'),
  name: z.string().trim().min(1, 'Missing event name'),
  props: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Client → server bridge for tracking. Authenticated callers POST
 * `{ channel, name, props }`; the event is attributed to their uid. Defaults to
 * the analytics channel. Tracking failures are swallowed server-side, so this
 * always returns ok for a well-formed request.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, TrackSchema)
  if (!parsed.ok) return parsed.response
  const { channel, name, props } = parsed.data

  const emitter = channel === 'insights' ? insights : analytics
  await emitter.track(name, { uid: auth.uid, props })

  return NextResponse.json({ ok: true })
}
