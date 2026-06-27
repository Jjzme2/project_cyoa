import type { TelemetryChannel } from '@/lib/telemetry'

/** Minimal shape we need from a Firebase user to authenticate the track call. */
interface TokenSource {
  getIdToken: () => Promise<string>
}

/**
 * Fire-and-forget client-side event tracking via POST /api/track.
 *
 * The endpoint requires auth, so anonymous readers are skipped for now (a
 * rate-limited anonymous path is tracked separately in TODO). Never throws and
 * never blocks the UI — instrumenting a component can't break it. Uses
 * `keepalive` so an event emitted right before navigation still gets sent.
 */
export async function trackEvent(
  user: TokenSource | null | undefined,
  name: string,
  opts: { channel?: TelemetryChannel; props?: Record<string, unknown> } = {},
): Promise<void> {
  if (!user) return
  try {
    const token = await user.getIdToken()
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ channel: opts.channel ?? 'analytics', name, props: opts.props ?? {} }),
      keepalive: true,
    })
  } catch {
    // best-effort — reading must never break because telemetry failed
  }
}
