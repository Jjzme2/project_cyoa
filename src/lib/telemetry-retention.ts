import { adminDb } from './firebase-admin'
import { eventsCollectionName, TELEMETRY_CHANNELS, type TelemetryChannel } from './telemetry'

/**
 * Telemetry retention: prune raw `<channel>Events` docs older than a cutoff,
 * keeping the `telemetryDaily` rollups (the long-term aggregates) intact.
 *
 * Invoked by the daily Vercel Cron at `/api/cron/telemetry-retention`. Work is
 * bounded per run (`maxDeletes`) so a backlog can't exceed the function's time
 * budget — `hasMore: true` signals the next run should continue.
 */

const DELETE_BATCH = 500 // Firestore's max writes per batch
const DEFAULT_RETENTION_DAYS = 30
const DEFAULT_MAX_DELETES = 10_000

export interface PruneResult {
  channel: TelemetryChannel
  deleted: number
  /** True if the per-run budget was hit before the backlog was cleared. */
  hasMore: boolean
}

/** ISO cutoff `days` before now. */
export function cutoffIso(days: number, now: number): string {
  return new Date(now - days * 86_400_000).toISOString()
}

/** Delete events in one channel older than `cutoff`, up to `maxDeletes`. */
export async function pruneChannel(
  channel: TelemetryChannel,
  cutoff: string,
  maxDeletes: number,
): Promise<PruneResult> {
  const collection = adminDb.collection(eventsCollectionName(channel))
  let deleted = 0

  for (;;) {
    if (deleted >= maxDeletes) return { channel, deleted, hasMore: true }

    const limit = Math.min(DELETE_BATCH, maxDeletes - deleted)
    const snap = await collection
      .where('createdAt', '<', cutoff)
      .orderBy('createdAt')
      .limit(limit)
      .get()

    if (snap.empty) break

    const batch = adminDb.batch()
    snap.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    deleted += snap.size

    // A short page means the channel is now drained of expired events.
    if (snap.size < limit) break
  }

  return { channel, deleted, hasMore: false }
}

export interface RetentionConfig {
  retentionDays?: number
  maxDeletesPerChannel?: number
  /** Override "now" (ms) for testing. */
  now?: number
}

/** Prune every telemetry channel. Reads defaults from env when not overridden. */
export async function pruneTelemetry(config: RetentionConfig = {}): Promise<{
  retentionDays: number
  cutoff: string
  results: PruneResult[]
}> {
  const retentionDays =
    config.retentionDays ?? (Number(process.env.TELEMETRY_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS)
  const maxDeletes = config.maxDeletesPerChannel ?? DEFAULT_MAX_DELETES
  const now = config.now ?? Date.now()
  const cutoff = cutoffIso(retentionDays, now)

  const results: PruneResult[] = []
  for (const channel of TELEMETRY_CHANNELS) {
    results.push(await pruneChannel(channel, cutoff, maxDeletes))
  }

  return { retentionDays, cutoff, results }
}
