import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Characters Fold 2d integration tests: the REAL characters + multiverse
 * modules run against a path-keyed in-memory Firestore fake (same shape as
 * money-paths.test.ts) so voting, sort re-ranking, and guest-star rating
 * gating are exercised end-to-end.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  function docRef(path: string): Record<string, unknown> {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        store.set(path, opts?.merge ? { ...(store.get(path) ?? {}), ...data } : data)
      },
      update: async (data: Record<string, unknown>) => {
        store.set(path, { ...(store.get(path) ?? {}), ...data })
      },
      delete: async () => {
        store.delete(path)
      },
      collection: (name: string) => collectionRef(`${path}/${name}`),
    }
  }

  function collectionRef(path: string) {
    return {
      doc: (id: string) => docRef(`${path}/${id}`),
      where: (field: string, _op: string, value: unknown) => ({
        limit: (n: number) => ({
          get: async () => {
            const docs = Array.from(store.entries())
              .filter(([p, data]) => p.startsWith(`${path}/`) && Array.isArray(data[field]) && (data[field] as unknown[]).includes(value))
              .slice(0, n)
              .map(([p, data]) => ({ id: p.split('/').pop(), data: () => data }))
            return { docs }
          },
        }),
      }),
      orderBy: (field: string) => ({
        limit: (n: number) => ({
          get: async () => {
            const docs = Array.from(store.entries())
              .filter(([p]) => p.startsWith(`${path}/`))
              .sort((a, b) => String(b[1][field] ?? '').localeCompare(String(a[1][field] ?? '')))
              .slice(0, n)
              .map(([p, data]) => ({ id: p.split('/').pop(), data: () => data }))
            return { docs }
          },
        }),
      }),
    }
  }

  const adminDb = {
    collection: (name: string) => collectionRef(name),
    runTransaction: async <T>(fn: (txn: unknown) => Promise<T>): Promise<T> => {
      const txn = {
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data })
        },
        set: (ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          store.set(ref.path, opts?.merge ? { ...(store.get(ref.path) ?? {}), ...data } : data)
        },
        delete: (ref: { path: string }) => {
          store.delete(ref.path)
        },
      }
      return fn(txn)
    },
  }

  return { store, adminDb }
})

vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))

import { getCharacter, listCharacters, getCharactersByWorld, toggleCharacterVote, hasCharacterVote } from '@/lib/firestore/characters'
import { getGuestStarCameos } from '@/lib/firestore/multiverse'

function seedCharacter(id: string, data: Record<string, unknown>) {
  h.store.set(`characters/${id}`, {
    name: id, scope: 'world', ownerId: 'w1', worldIds: ['w1'], storyCount: 1, appearances: [],
    firstSeenAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...data,
  })
}

beforeEach(() => {
  h.store.clear()
})

describe('toggleCharacterVote', () => {
  it('votes, then un-votes on a second toggle', async () => {
    seedCharacter('c1', { voteCount: 0, voterIds: [] })
    const first = await toggleCharacterVote('c1', 'u1')
    expect(first).toEqual({ voted: true, count: 1 })
    const second = await toggleCharacterVote('c1', 'u1')
    expect(second).toEqual({ voted: false, count: 0 })
  })

  it('never goes negative even if state is inconsistent', async () => {
    seedCharacter('c1', { voteCount: 0, voterIds: ['u1'] })
    const result = await toggleCharacterVote('c1', 'u1')
    expect(result.voted).toBe(false)
    expect(result.count).toBe(0)
  })

  it('multiple distinct voters each count once, stored as marker docs (not a growing array)', async () => {
    seedCharacter('c1', { voteCount: 0 })
    await toggleCharacterVote('c1', 'u1')
    await toggleCharacterVote('c1', 'u2')
    const char = await getCharacter('c1')
    expect(char?.voteCount).toBe(2)
    // New votes live in the votes/{uid} subcollection, never the character doc.
    expect(char?.voterIds).toBeUndefined()
    expect(h.store.has('characters/c1/votes/u1')).toBe(true)
    expect(h.store.has('characters/c1/votes/u2')).toBe(true)
  })

  it('a legacy voterIds entry still counts and is removed on un-vote (no backfill)', async () => {
    seedCharacter('c1', { voteCount: 3, voterIds: ['legacyUser', 'x', 'y'] })
    const res = await toggleCharacterVote('c1', 'legacyUser')
    expect(res).toEqual({ voted: false, count: 2 })
    const char = await getCharacter('c1')
    expect(char?.voterIds).toEqual(['x', 'y']) // shrinks, never grows
  })
})

describe('hasCharacterVote', () => {
  it('reflects a fresh (subcollection) vote', async () => {
    seedCharacter('c1', { voteCount: 0 })
    expect(await hasCharacterVote('c1', 'u1')).toBe(false)
    await toggleCharacterVote('c1', 'u1')
    expect(await hasCharacterVote('c1', 'u1')).toBe(true)
  })

  it('honors a legacy voterIds entry', async () => {
    seedCharacter('c1', { voteCount: 1, voterIds: ['legacyUser'] })
    expect(await hasCharacterVote('c1', 'legacyUser')).toBe(true)
    expect(await hasCharacterVote('c1', 'someoneElse')).toBe(false)
  })
})

describe('listCharacters — "loved" re-ranking', () => {
  it('sorts by vote count, including characters with no voteCount at all', async () => {
    seedCharacter('unloved', { updatedAt: '2026-01-03T00:00:00Z' }) // no voteCount field
    seedCharacter('popular', { updatedAt: '2026-01-02T00:00:00Z', voteCount: 10 })
    seedCharacter('mid', { updatedAt: '2026-01-01T00:00:00Z', voteCount: 3 })

    const recent = await listCharacters(60, 'recent')
    expect(recent.map((c) => c.id)).toEqual(['unloved', 'popular', 'mid'])

    const loved = await listCharacters(60, 'loved')
    expect(loved.map((c) => c.id)).toEqual(['popular', 'mid', 'unloved'])
  })
})

describe('getCharactersByWorld — sort param', () => {
  it('re-ranks by voteCount when sort is "loved"', async () => {
    seedCharacter('a', { updatedAt: '2026-01-01T00:00:00Z', voteCount: 1, worldIds: ['w1'] })
    seedCharacter('b', { updatedAt: '2026-01-02T00:00:00Z', voteCount: 9, worldIds: ['w1'] })
    const loved = await getCharactersByWorld('w1', 40, 'loved')
    expect(loved.map((c) => c.id)).toEqual(['b', 'a'])
  })
})

describe('getGuestStarCameos', () => {
  it('returns an empty array for no ids', async () => {
    expect(await getGuestStarCameos([])).toEqual([])
  })

  it('gates a scope:"world" guest star against its origin world rating', async () => {
    seedCharacter('mature-hero', { name: 'Mature Hero', scope: 'world', ownerId: 'origin-world', tagline: 'A grim wanderer' })
    h.store.set('worlds/origin-world', { rating: 'Mature' })

    const gated = await getGuestStarCameos(['mature-hero'], { maxRating: 'Everyone' })
    expect(gated).toEqual([])

    const allowed = await getGuestStarCameos(['mature-hero'], { maxRating: 'Mature' })
    expect(allowed).toHaveLength(1)
    expect(allowed[0].figures).toEqual([{ name: 'Mature Hero', note: 'A grim wanderer' }])
  })

  it('trusts a scope:"author" guest star with no origin world to rate-gate', async () => {
    seedCharacter('personal-hero', { name: 'Personal Hero', scope: 'author', ownerId: 'author-1' })
    const cameos = await getGuestStarCameos(['personal-hero'], { maxRating: 'Everyone' })
    expect(cameos).toHaveLength(1)
    expect(cameos[0].figures[0].name).toBe('Personal Hero')
  })

  it('caps at 5 characters', async () => {
    for (let i = 0; i < 8; i++) seedCharacter(`c${i}`, { name: `Char ${i}` })
    const cameos = await getGuestStarCameos(Array.from({ length: 8 }, (_, i) => `c${i}`))
    expect(cameos[0].figures).toHaveLength(5)
  })
})
