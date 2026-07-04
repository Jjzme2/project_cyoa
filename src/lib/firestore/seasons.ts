import { adminDb } from '../firebase-admin'
import { isSeasonLive, rollSeasonWindow } from '../seasons'
import type { Season } from '@/types'

// ─── Seasons (live events) ───────────────────────────────────────────────────

function seasonsCollection() {
  return adminDb.collection('seasons')
}

export async function listSeasons(): Promise<Season[]> {
  const snap = await seasonsCollection().orderBy('startsAt', 'desc').limit(100).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Season))
}

export async function getSeason(id: string): Promise<Season | null> {
  const doc = await seasonsCollection().doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Season
}

/** All published seasons whose window contains now, soonest-ending first. */
export async function getLiveSeasons(now: Date = new Date()): Promise<Season[]> {
  const snap = await seasonsCollection().where('published', '==', true).limit(100).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Season))
    .filter((s) => isSeasonLive(s, now))
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
}

export interface SeasonInput {
  recurrence?: 'none' | 'monthly' | 'yearly'
  name: string
  tagline: string
  description: string
  prompt?: string
  startsAt: string
  endsAt: string
  accent?: string
  published: boolean
  multiverseId?: string | null
  multiverseName?: string | null
}

/** Create a season (no id) or update an existing one (id given). Returns the id. */
export async function upsertSeason(input: SeasonInput, createdBy: string, id?: string): Promise<string> {
  const now = new Date().toISOString()
  if (id) {
    await seasonsCollection().doc(id).set({ ...input, updatedAt: now }, { merge: true })
    return id
  }
  const ref = await seasonsCollection().add({ ...input, createdBy, createdAt: now, updatedAt: now })
  return ref.id
}

export async function deleteSeason(id: string): Promise<void> {
  await seasonsCollection().doc(id).delete()
}

/**
 * Roll every ended, recurring, published season's window forward (see
 * rollSeasonWindow) — the self-sustaining live-ops heartbeat, run by the daily
 * rotation cron. Returns the ids that rolled.
 */
export async function rotateExpiredSeasons(now: Date = new Date()): Promise<string[]> {
  const all = await listSeasons()
  const rolled: string[] = []
  for (const s of all) {
    if (!s.published) continue
    const next = rollSeasonWindow(s, now)
    if (next) {
      await seasonsCollection().doc(s.id).update({ ...next, updatedAt: new Date().toISOString() })
      rolled.push(s.id)
    }
  }
  return rolled
}
