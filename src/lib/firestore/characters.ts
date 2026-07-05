import { adminDb } from '../firebase-admin'
import { cacheLife, cacheTag } from 'next/cache'
import { characterId } from '../characters'
import type { Character, CharacterAppearance, CharacterScope } from '@/types'

// ─── First-class Character registry ──────────────────────────────────────────

const APPEARANCE_CAP = 24

function charactersCollection() {
  return adminDb.collection('characters')
}

export async function getCharacter(id: string): Promise<Character | null> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`character-${id}`, 'characters')

  const doc = await charactersCollection().doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Character
}

/**
 * Directory listing: most-recently-active, or community-voted "most loved"
 * first. `voteCount` is absent on characters that predate voting (or have
 * none yet) — a plain `orderBy('voteCount')` would silently exclude them
 * (Firestore drops docs missing the ordered field), so "loved" instead reads
 * a bounded recent batch and re-ranks it in memory. Fine at this app's scale;
 * matches the same bounded-scan trade-off already made in admin user search.
 */
export async function listCharacters(limit = 60, sort: 'recent' | 'loved' = 'recent'): Promise<Character[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag('characters')

  const fetchLimit = sort === 'loved' ? Math.min(limit * 3, 200) : limit
  const snap = await charactersCollection().orderBy('updatedAt', 'desc').limit(fetchLimit).get()
  const chars = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Character))
  if (sort !== 'loved') return chars
  return chars.sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0)).slice(0, limit)
}

function characterVoteRef(id: string, userId: string) {
  return charactersCollection().doc(id).collection('votes').doc(userId)
}

/** Whether `userId` has voted for character `id`. Honors both the marker
 * subcollection (current) and the legacy `voterIds` array (pre-migration). */
export async function hasCharacterVote(id: string, userId: string): Promise<boolean> {
  const [voteDoc, charDoc] = await Promise.all([
    characterVoteRef(id, userId).get(),
    charactersCollection().doc(id).get(),
  ])
  if (voteDoc.exists) return true
  return ((charDoc.data()?.voterIds as string[] | undefined) ?? []).includes(userId)
}

/**
 * Toggle the caller's "best character" vote — community curation for the
 * directory's "most loved" sort. Each voter is a `votes/{uid}` marker doc so
 * one reader counts at most once without a per-character voter list to grow or
 * rewrite; `voteCount` stays denormalized on the character for the sort.
 * Legacy `voterIds` entries (from before this subcollection existed) still count
 * as a vote and are removed on un-vote, so no backfill is needed and that array
 * only ever shrinks.
 */
export async function toggleCharacterVote(id: string, userId: string): Promise<{ voted: boolean; count: number }> {
  const ref = charactersCollection().doc(id)
  const voteRef = characterVoteRef(id, userId)
  let voted = false
  let count = 0

  await adminDb.runTransaction(async (txn) => {
    // All reads before any writes (Firestore transaction rule).
    const [doc, voteDoc] = await Promise.all([txn.get(ref), txn.get(voteRef)])
    if (!doc.exists) return
    const data = doc.data() as Character
    const legacyVoterIds = data.voterIds ?? []
    const inLegacy = legacyVoterIds.includes(userId)
    const curCount = data.voteCount ?? 0

    if (voteDoc.exists || inLegacy) {
      if (voteDoc.exists) txn.delete(voteRef)
      const update: Record<string, unknown> = { voteCount: Math.max(0, curCount - 1) }
      if (inLegacy) update.voterIds = legacyVoterIds.filter((v) => v !== userId)
      txn.update(ref, update)
      voted = false
      count = Math.max(0, curCount - 1)
    } else {
      txn.set(voteRef, { at: new Date().toISOString() })
      txn.update(ref, { voteCount: curCount + 1 })
      voted = true
      count = curCount + 1
    }
  })

  return { voted, count }
}

/**
 * Characters that have appeared in a given world (canon figures + visiting
 * heroes) — most recent, or community-voted "most loved" first (surfaces the
 * community's favorites when picking cross-world cameo figures).
 */
export async function getCharactersByWorld(
  worldId: string,
  limit = 40,
  sort: 'recent' | 'loved' = 'recent',
): Promise<Character[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`characters-world-${worldId}`, 'characters')

  const snap = await charactersCollection().where('worldIds', 'array-contains', worldId).limit(limit).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Character))
    .sort((a, b) =>
      sort === 'loved' ? (b.voteCount ?? 0) - (a.voteCount ?? 0) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    )
}

export interface RegisterCharacterParams {
  scope: CharacterScope
  ownerId: string
  name: string
  description?: string
  tagline?: string
  appearance: CharacterAppearance
}

/**
 * Upsert a character and record an appearance, transactionally. Idempotent per
 * story: re-registering the same story doesn't double-count. New worlds extend
 * `worldIds` (the cross-world / multiverse-cameo signal); the first non-empty
 * description/tagline sticks.
 */
export async function registerCharacterAppearance(params: RegisterCharacterParams): Promise<string> {
  const { scope, ownerId, name, description, tagline, appearance } = params
  const id = characterId(scope, ownerId, name)
  const ref = charactersCollection().doc(id)
  const now = new Date().toISOString()

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) {
      txn.set(ref, {
        name: name.slice(0, 80),
        scope,
        ownerId,
        ...(tagline ? { tagline: tagline.slice(0, 140) } : {}),
        ...(description ? { description: description.slice(0, 600) } : {}),
        worldIds: [appearance.worldId],
        storyCount: 1,
        appearances: [appearance],
        voteCount: 0,
        firstSeenAt: now,
        updatedAt: now,
      })
      return
    }

    const data = doc.data() as Character
    const appearances = data.appearances ?? []
    const alreadyHasStory = appearances.some((a) => a.storyId === appearance.storyId)
    if (alreadyHasStory) return // idempotent

    const worldIds = data.worldIds ?? []
    const nextWorldIds = worldIds.includes(appearance.worldId) ? worldIds : [...worldIds, appearance.worldId]
    const nextAppearances = [appearance, ...appearances].slice(0, APPEARANCE_CAP)

    txn.update(ref, {
      worldIds: nextWorldIds,
      storyCount: (data.storyCount ?? appearances.length) + 1,
      appearances: nextAppearances,
      // Backfill identity text if it wasn't set on first sight.
      ...(!data.description && description ? { description: description.slice(0, 600) } : {}),
      ...(!data.tagline && tagline ? { tagline: tagline.slice(0, 140) } : {}),
      updatedAt: now,
    })
  })

  return id
}

/** Set (or replace) a character's generated portrait. */
export async function setCharacterPortrait(id: string, portraitUrl: string): Promise<void> {
  await charactersCollection().doc(id).update({ portraitUrl, updatedAt: new Date().toISOString() })
}
