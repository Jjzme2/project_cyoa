import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Achievements v2 integration tests: the REAL achievements module runs against
 * an in-memory Firestore fake (same shape as money-paths.test.ts) so the
 * reward grant + notification write are exercised atomically, not mocked away.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()

  const applyValues = (prev: Record<string, unknown>, data: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...prev }
    for (const [k, v] of Object.entries(data)) {
      const isIncrement = v && typeof v === 'object' && '__increment' in (v as Record<string, unknown>)
      const value = isIncrement ? (((prev[k] as number) ?? 0) + (v as { __increment: number }).__increment) : v
      next[k] = value
    }
    return next
  }

  function docRef(path: string): Record<string, unknown> {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        store.set(path, applyValues(opts?.merge ? (store.get(path) ?? {}) : {}, data))
      },
      collection: (name: string) => collectionRef(`${path}/${name}`),
    }
  }

  function collectionRef(path: string) {
    let autoSeq = 0
    return {
      doc: (id?: string) => docRef(`${path}/${id ?? `auto-${autoSeq++}`}`),
    }
  }

  const adminDb = {
    collection: (name: string) => collectionRef(name),
    runTransaction: async <T>(fn: (txn: unknown) => Promise<T>): Promise<T> => {
      const txn = {
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        set: (ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          store.set(ref.path, applyValues(opts?.merge ? (store.get(ref.path) ?? {}) : {}, data))
        },
      }
      return fn(txn)
    },
  }

  return { store, adminDb }
})

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }) },
}))
vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))

import { checkAndAwardAchievements, getUserAchievements } from '@/lib/firestore/achievements'
import { ACHIEVEMENT_DEFS } from '@/types'

const creditsOf = (uid: string) => (h.store.get(`userSettings/${uid}`)?.purchasedCredits as number) ?? 0
const notificationsFor = (uid: string) =>
  Array.from(h.store.entries())
    .filter(([path]) => path.startsWith(`users/${uid}/notifications/`))
    .map(([, data]) => data as { type: string; achievementId: string })

function rewardOf(id: string): number {
  return ACHIEVEMENT_DEFS.find((d) => d.id === id)?.reward ?? 0
}

beforeEach(() => {
  h.store.clear()
})

describe('checkAndAwardAchievements', () => {
  it('awards the reward credits and a notification atomically on first earn', async () => {
    const earned = await checkAndAwardAchievements('u1', 'contribution')
    expect(earned).toEqual(['first_step'])
    expect(creditsOf('u1')).toBe(rewardOf('first_step'))
    const notifs = notificationsFor('u1')
    expect(notifs).toHaveLength(1)
    expect(notifs[0]).toMatchObject({ type: 'achievement_earned', achievementId: 'first_step' })
  })

  it('never re-earns (or re-grants) the same achievement', async () => {
    await checkAndAwardAchievements('u1', 'contribution')
    const secondEarn = await checkAndAwardAchievements('u1', 'contribution')
    expect(secondEarn).toEqual([])
    expect(creditsOf('u1')).toBe(rewardOf('first_step'))
    expect(notificationsFor('u1')).toHaveLength(1)
  })

  it('crosses count thresholds correctly (prolific at 10 contributions)', async () => {
    for (let i = 0; i < 9; i++) await checkAndAwardAchievements('u1', 'contribution')
    let user = await getUserAchievements('u1')
    expect(user.earned).not.toContain('prolific')
    const tenth = await checkAndAwardAchievements('u1', 'contribution')
    expect(tenth).toContain('prolific')
    user = await getUserAchievements('u1')
    expect(user.counts.contributions).toBe(10)
  })

  it.each([
    ['saga_created', 'wanderer'],
    ['feedback_submitted', 'voice_heard'],
    ['bounty_posted', 'patron'],
    ['bounty_filled', 'mercenary'],
    ['npc_bond', 'kindred_spirit'],
    ['path_traversal_milestone', 'path_pioneer'],
  ] as const)('%s event awards %s', async (event, achievementId) => {
    const earned = await checkAndAwardAchievements('u1', event)
    expect(earned).toEqual([achievementId])
  })

  it('awards "renowned" once world standing reaches 0.7', async () => {
    const low = await checkAndAwardAchievements('u1', 'world_standing', { standing: 0.4 })
    expect(low).toEqual([])
    const high = await checkAndAwardAchievements('u1', 'world_standing', { standing: 0.7 })
    expect(high).toEqual(['renowned'])
    // A later, lower observation never un-earns it, and the best-ever high-water
    // mark is preserved rather than overwritten downward.
    await checkAndAwardAchievements('u1', 'world_standing', { standing: 0.1 })
    const user = await getUserAchievements('u1')
    expect(user.counts.bestWorldStanding).toBe(0.7)
  })

  it('ending_reached is idempotent per ending key', async () => {
    const first = await checkAndAwardAchievements('u1', 'ending_reached', { endingType: 'secret', endingKey: 'story1:nodeA' })
    expect(first).toEqual(expect.arrayContaining(['the_end', 'secret_keeper']))
    await checkAndAwardAchievements('u1', 'ending_reached', { endingType: 'secret', endingKey: 'story1:nodeA' })
    const user = await getUserAchievements('u1')
    expect(user.counts.endingsReached).toBe(1) // re-reaching the same ending doesn't inflate the count
  })

  it('awards "completionist" once every other achievement is earned', async () => {
    // Seed every achievement except completionist directly, then trigger any
    // event — the capstone check runs (and fires) regardless of which event.
    const allButCompletionist = ACHIEVEMENT_DEFS.map((d) => d.id).filter((id) => id !== 'completionist')
    await h.adminDb.runTransaction(async (txn: unknown) => {
      const t = txn as { set: (ref: { path: string }, data: unknown) => void }
      t.set({ path: 'achievements/u1' }, {
        earned: allButCompletionist,
        counts: {},
        updatedAt: new Date().toISOString(),
      })
    })
    const earned = await checkAndAwardAchievements('u1', 'bookmark')
    expect(earned).toEqual(['completionist'])
    expect(creditsOf('u1')).toBe(rewardOf('completionist'))
    const user = await getUserAchievements('u1')
    expect(user.earned).toContain('completionist')
  })
})
