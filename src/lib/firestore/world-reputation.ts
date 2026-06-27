import { adminDb } from '../firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'

// ─── "You" mode: per-reader, per-world reputation ─────────────────────────────

function worldRepRef(userId: string, worldId: string) {
  return adminDb.collection('worldReputation').doc(`${userId}__${worldId}`)
}

/** A world's memory of a reader fades toward neutral over time (~30-day half-life). */
export function decayStanding(standing: number, updatedAt?: string): number {
  if (!standing || !updatedAt) return standing ?? 0
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000
  if (days <= 0) return standing
  return Math.round(standing * Math.pow(0.5, days / 30) * 100) / 100
}

/** A reader's (time-decayed) standing in a world (-1..1); 0 when a stranger here. */
export async function getWorldStanding(userId: string, worldId: string): Promise<number> {
  const doc = await worldRepRef(userId, worldId).get()
  if (!doc.exists) return 0
  return decayStanding((doc.data()?.standing as number) ?? 0, doc.data()?.updatedAt as string)
}

export type StandingTrend = 'rising' | 'falling' | 'steady'

/** Decayed standing plus a recent trend, for the reader-facing badge. */
export async function getWorldReputation(
  userId: string,
  worldId: string,
): Promise<{ standing: number; trend: StandingTrend; samples: number }> {
  const doc = await worldRepRef(userId, worldId).get()
  if (!doc.exists) return { standing: 0, trend: 'steady', samples: 0 }
  const data = doc.data() ?? {}
  const standing = decayStanding((data.standing as number) ?? 0, data.updatedAt as string)
  const history = (data.history as { standing: number; at: string }[] | undefined) ?? []
  let trend: StandingTrend = 'steady'
  if (history.length >= 2) {
    const earlier = history[Math.max(0, history.length - 4)].standing
    const latest = history[history.length - 1].standing
    const delta = latest - earlier
    trend = delta > 0.08 ? 'rising' : delta < -0.08 ? 'falling' : 'steady'
  }
  return { standing, trend, samples: history.length }
}

/**
 * Nudge a reader's world standing toward the standing observed in the story they
 * just played (EMA, after time-decay), so the world remembers them across
 * stories — and keeps a short history for trend display.
 */
export async function updateWorldStanding(
  userId: string,
  worldId: string,
  observed: number,
  name?: string,
): Promise<void> {
  const ref = worldRepRef(userId, worldId)
  const now = new Date().toISOString()
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const data = doc.exists ? doc.data() ?? {} : {}
    const prior = decayStanding((data.standing as number) ?? 0, data.updatedAt as string)
    const next = Math.max(-1, Math.min(1, Math.round((prior + (observed - prior) * 0.3) * 100) / 100))
    const history = [...(((data.history as { standing: number; at: string }[]) ?? [])), { standing: next, at: now }].slice(-12)
    txn.set(ref, { userId, worldId, name: name ?? data.name ?? 'A wanderer', standing: next, updatedAt: now, history }, { merge: true })
  })
}

// ─── Per-world collective regard for "Outsiders" (saga protagonists) ──────────
// In a "You" mode saga the reader is a foreigner to the world. Beyond each
// reader's PERSONAL standing, the world forms ONE collective opinion of
// outsiders as a kind — shaped by the conduct of every saga played here. It
// fades toward neutral slowly (a people's grudges and gratitude outlast any one
// visitor), and biases how strangers first regard the NEXT outsider to arrive.

function worldOutsiderRef(worldId: string) {
  return adminDb.collection('worldOutsiders').doc(worldId)
}

/** Collective regard fades toward neutral on a ~90-day half-life (slower than personal). */
function decayRegard(regard: number, updatedAt?: string): number {
  if (!regard || !updatedAt) return regard ?? 0
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000
  if (days <= 0) return regard
  return Math.round(regard * Math.pow(0.5, days / 90) * 100) / 100
}

export type OutsiderTier = 'reviled' | 'distrusted' | 'unknown' | 'welcomed' | 'revered'

export interface OutsiderRegard {
  regard: number // -1..1 collective disposition toward outsiders
  tier: OutsiderTier
  deeds: number // judged saga deeds that have shaped it
  trend: StandingTrend
}

/** Map a collective regard value to the world's disposition tier. */
export function outsiderTier(regard: number): OutsiderTier {
  if (regard <= -0.6) return 'reviled'
  if (regard <= -0.2) return 'distrusted'
  if (regard < 0.2) return 'unknown'
  if (regard < 0.6) return 'welcomed'
  return 'revered'
}

/** A world's collective regard for outsiders (decayed), with trend. 0 when untested. */
export async function getWorldOutsiderRegard(worldId: string): Promise<OutsiderRegard> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`world-outsiders-${worldId}`)

  const doc = await worldOutsiderRef(worldId).get()
  if (!doc.exists) return { regard: 0, tier: 'unknown', deeds: 0, trend: 'steady' }
  const data = doc.data() ?? {}
  const regard = decayRegard((data.regard as number) ?? 0, data.updatedAt as string)
  const history = (data.history as { regard: number; at: string }[] | undefined) ?? []
  let trend: StandingTrend = 'steady'
  if (history.length >= 2) {
    const earlier = history[Math.max(0, history.length - 4)].regard
    const latest = history[history.length - 1].regard
    const delta = latest - earlier
    trend = delta > 0.05 ? 'rising' : delta < -0.05 ? 'falling' : 'steady'
  }
  return { regard, tier: outsiderTier(regard), deeds: (data.deeds as number) ?? 0, trend }
}

/**
 * Fold one saga chapter's observed conduct into a world's COLLECTIVE regard for
 * outsiders. The aggregate moves slowly (small EMA weight) so no single reader
 * swings a whole people's opinion — but many sagas, compounding, do.
 */
export async function updateWorldOutsiderRegard(worldId: string, observed: number): Promise<void> {
  const ref = worldOutsiderRef(worldId)
  const now = new Date().toISOString()
  const clampedObs = Math.max(-1, Math.min(1, observed))
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const data = doc.exists ? doc.data() ?? {} : {}
    const prior = decayRegard((data.regard as number) ?? 0, data.updatedAt as string)
    const next = Math.max(-1, Math.min(1, Math.round((prior + (clampedObs - prior) * 0.12) * 100) / 100))
    const deeds = ((data.deeds as number) ?? 0) + 1
    const history = [...(((data.history as { regard: number; at: string }[]) ?? [])), { regard: next, at: now }].slice(-12)
    txn.set(ref, { worldId, regard: next, deeds, updatedAt: now, history }, { merge: true })
  })
}

// ─── World Chronicle + Legends ────────────────────────────────────────────────

/** The Legends board: notable figures in a world, by (decayed) standing. */
