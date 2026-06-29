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

/** Directory listing, most-recently-active first. */
export async function listCharacters(limit = 60): Promise<Character[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag('characters')

  const snap = await charactersCollection().orderBy('updatedAt', 'desc').limit(limit).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Character))
}

/** Characters that have appeared in a given world (canon figures + visiting heroes). */
export async function getCharactersByWorld(worldId: string, limit = 40): Promise<Character[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`characters-world-${worldId}`, 'characters')

  const snap = await charactersCollection().where('worldIds', 'array-contains', worldId).limit(limit).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Character))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
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
