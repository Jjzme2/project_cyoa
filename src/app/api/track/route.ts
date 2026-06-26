import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { analytics, insights, type TelemetryChannel } from '@/lib/telemetry'

const CHANNELS: TelemetryChannel[] = ['analytics', 'insights']

/**
 * Client → server bridge for tracking. Authenticated callers POST
 * `{ channel, name, props }`; the event is attributed to their uid. Defaults to
 * the analytics channel. Tracking failures are swallowed server-side, so this
 * always returns ok for a well-formed request.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { channel?: string; name?: string; props?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Missing event name' }, { status: 400 })

  const channel: TelemetryChannel = CHANNELS.includes(body.channel as TelemetryChannel)
    ? (body.channel as TelemetryChannel)
    : 'analytics'

  const props = body.props && typeof body.props === 'object' ? body.props : undefined
  const emitter = channel === 'insights' ? insights : analytics
  await emitter.track(name, { uid: auth.uid, props })

  return NextResponse.json({ ok: true })
}
