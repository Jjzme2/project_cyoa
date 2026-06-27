import { adminDb } from '../firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'
import type { ChronicleEntry } from '@/types'
import { decayStanding } from './world-reputation'

// ─── World Chronicle + Legends ───────────────────────────────────────────────

export async function getWorldLegends(
  worldId: string,
): Promise<{ revered: { name: string; standing: number }[]; reviled: { name: string; standing: number }[] }> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`world-legends-${worldId}`)

  const snap = await adminDb.collection('worldReputation').where('worldId', '==', worldId).limit(300).get()
  const figures = snap.docs
    .map((d) => {
      const data = d.data()
      return { name: (data.name as string) ?? 'A wanderer', standing: decayStanding((data.standing as number) ?? 0, data.updatedAt as string) }
    })
    .filter((f) => Math.abs(f.standing) >= 0.25) // only those who've made a mark
  const revered = figures.filter((f) => f.standing > 0).sort((a, b) => b.standing - a.standing).slice(0, 5)
  const reviled = figures.filter((f) => f.standing < 0).sort((a, b) => a.standing - b.standing).slice(0, 5)
  return { revered, reviled }
}

function chronicleRef(worldId: string) {
  return adminDb.collection('worldChronicle').doc(worldId)
}

/** Recent legendary deeds recorded in a world (most recent first). */
export async function getWorldChronicle(worldId: string): Promise<ChronicleEntry[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`world-chronicle-${worldId}`)

  const doc = await chronicleRef(worldId).get()
  if (!doc.exists) return []
  const entries = (doc.data()?.entries as ChronicleEntry[] | undefined) ?? []
  return [...entries].reverse()
}

/** Append a notable deed to a world's chronicle (capped). */
export async function appendWorldChronicle(worldId: string, entry: ChronicleEntry): Promise<void> {
  const ref = chronicleRef(worldId)
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const entries = (doc.exists ? (doc.data()?.entries as ChronicleEntry[]) : undefined) ?? []
    const next = [...entries, entry].slice(-40)
    txn.set(ref, { worldId, entries: next, updatedAt: new Date().toISOString() }, { merge: true })
  })
}

/** Append emergent canon characters to a story, deduped by name (case-insensitive). */
