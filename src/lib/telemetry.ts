import { adminDb } from './firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * Lightweight, Firestore-backed event tracking.
 *
 * Two channels share one mechanism:
 *   - `analytics` — quantitative product events (creations, reads, conversions)
 *     you want to count and trend over time.
 *   - `insights`  — notable, lower-volume signals worth reading individually
 *     (admin actions, milestones, anomalies).
 *
 * Each `track()` does two cheap writes: it appends the raw event to
 * `<channel>Events` and bumps a per-day aggregate in `telemetryDaily` so the
 * admin dashboard can read totals without scanning the event stream.
 *
 * Tracking is fire-and-forget: it catches everything and never throws into the
 * caller, so instrumenting a code path can't break it. Prefer `void
 * analytics.track(...)` (or Next's `after(...)`) at call sites you don't want to
 * await.
 */

export type TelemetryChannel = 'analytics' | 'insights'

export interface TrackOptions {
  /** Associate the event with a user, when known. */
  uid?: string | null
  /** Shallow, JSON-serializable properties. Large/odd values are coerced. */
  props?: Record<string, unknown>
}

export interface DailyBucket {
  date: string
  total: number
  events: Record<string, number>
}

export interface TelemetryEvent {
  id: string
  channel: TelemetryChannel
  name: string
  uid: string | null
  props: Record<string, unknown>
  date: string
  createdAt: string
}

const MAX_NAME = 120
const MAX_STRING_PROP = 500

function eventsCollection(channel: TelemetryChannel): string {
  return `${channel}Events`
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

/** Firestore map keys can't contain `.`, `/`, `[` etc. — make the name safe. */
function aggKey(name: string): string {
  return name.replace(/[.~*/[\]]/g, '_')
}

function sanitizeProps(props?: Record<string, unknown>): Record<string, unknown> {
  if (!props) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue
    if (typeof v === 'string') out[k] = v.slice(0, MAX_STRING_PROP)
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v
    else out[k] = String(v).slice(0, MAX_STRING_PROP)
  }
  return out
}

async function track(channel: TelemetryChannel, name: string, opts: TrackOptions = {}): Promise<void> {
  try {
    const date = todayUTC()
    const safeName = String(name).slice(0, MAX_NAME)
    const event = {
      channel,
      name: safeName,
      uid: opts.uid ?? null,
      props: sanitizeProps(opts.props),
      date,
      createdAt: new Date().toISOString(),
      ts: FieldValue.serverTimestamp(),
    }

    const appendEvent = adminDb.collection(eventsCollection(channel)).add(event)
    // Merge into a per-channel, per-day rollup. Nested `events` map keeps a
    // per-event-name tally; `total` is the day's count for the channel.
    const bumpDaily = adminDb
      .collection('telemetryDaily')
      .doc(`${channel}_${date}`)
      .set(
        {
          channel,
          date,
          total: FieldValue.increment(1),
          events: { [aggKey(safeName)]: FieldValue.increment(1) },
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      )

    await Promise.all([appendEvent, bumpDaily])
  } catch (err) {
    // Telemetry must never break the request that emits it.
    console.warn(`[telemetry] ${channel}.track("${name}") failed:`, err)
  }
}

export const analytics = {
  /** Record a quantitative product event. */
  track: (name: string, opts?: TrackOptions) => track('analytics', name, opts),
}

export const insights = {
  /** Record a notable signal worth reading individually. */
  track: (name: string, opts?: TrackOptions) => track('insights', name, opts),
}

// ─── Reads (admin dashboard) ────────────────────────────────────────────────

function lastNDates(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    out.push(d.toISOString().slice(0, 10))
  }
  return out // most-recent first
}

/** Per-day rollups for a channel over the last `days` (most recent first). */
export async function getDailyBuckets(
  channel: TelemetryChannel,
  days = 14,
): Promise<DailyBucket[]> {
  try {
    const dates = lastNDates(Math.min(Math.max(days, 1), 90))
    const refs = dates.map((d) => adminDb.collection('telemetryDaily').doc(`${channel}_${d}`))
    const snaps = await adminDb.getAll(...refs)
    return snaps.map((snap, i) => {
      const data = snap.exists ? snap.data() : null
      return {
        date: dates[i],
        total: (data?.total as number) ?? 0,
        events: (data?.events as Record<string, number>) ?? {},
      }
    })
  } catch (err) {
    console.warn('[telemetry] getDailyBuckets failed:', err)
    return []
  }
}

/** Recent raw events for a channel, newest first (single-field index only). */
export async function getRecentEvents(
  channel: TelemetryChannel,
  limit = 50,
): Promise<TelemetryEvent[]> {
  try {
    const snap = await adminDb
      .collection(eventsCollection(channel))
      .orderBy('createdAt', 'desc')
      .limit(Math.min(Math.max(limit, 1), 200))
      .get()
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        channel,
        name: (data.name as string) ?? '',
        uid: (data.uid as string | null) ?? null,
        props: (data.props as Record<string, unknown>) ?? {},
        date: (data.date as string) ?? '',
        createdAt: (data.createdAt as string) ?? '',
      }
    })
  } catch (err) {
    console.warn('[telemetry] getRecentEvents failed:', err)
    return []
  }
}
