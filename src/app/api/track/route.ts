import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { throttle } from '@/lib/rate-limit'
import { analytics, insights } from '@/lib/telemetry'

// Invalid/missing channels fall back to analytics, matching the prior behavior.
const TrackSchema = z.object({
  channel: z.enum(['analytics', 'insights']).catch('analytics').default('analytics'),
  name: z.string().trim().min(1, 'Missing event name'),
  props: z.record(z.string(), z.unknown()).optional(),
})

/**
 * The only event names the CLIENT may emit — everything else is dropped
 * silently, so the analytics collections can't be polluted with arbitrary
 * names. Server-side emitters are unaffected (they don't go through here).
 */
const CLIENT_EVENT_ALLOWLIST = new Set([
  'story.opened',
  'chapter.reached',
  'ending.reached',
  'onboarding.jumped_in',
  'onboarding.welcome_shown',
  'onboarding.welcome_dismissed',
  'onboarding.first_write_nudged',
  'onboarding.teaser_choice_clicked',
])

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

  // Unknown event names are dropped silently — tracking is best-effort, and a
  // 200 keeps old/modified clients from retry-hammering.
  if (!CLIENT_EVENT_ALLOWLIST.has(name)) {
    return NextResponse.json({ ok: true, dropped: true })
  }

  // Abuse guard: cap client-emitted events per minute. Excess is dropped
  // silently — tracking is best-effort, so this stays a 200 either way.
  if (!(await throttle(`track:${auth.uid}`, 120, 60))) {
    return NextResponse.json({ ok: true, dropped: true })
  }

  const emitter = channel === 'insights' ? insights : analytics
  await emitter.track(name, { uid: auth.uid, props })

  return NextResponse.json({ ok: true })
}
