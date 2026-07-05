import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Pal adoption is a money path: the first pal is free (grandfathered), owned
 * pals switch freely, new pals cost purchased credits, achievement gates are
 * checked before any charge, and a failed write refunds the hold.
 */
const h = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()
  let failNextSet = false

  const adminDb = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: store.has(`${name}/${id}`), data: () => store.get(`${name}/${id}`) }),
        set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
          if (failNextSet) {
            failNextSet = false
            throw new Error('write failed')
          }
          const path = `${name}/${id}`
          store.set(path, opts?.merge ? { ...(store.get(path) ?? {}), ...data } : data)
        },
      }),
    }),
  }

  const holdPurchased = vi.fn(async () => true)
  const grantCredits = vi.fn(async () => {})
  const getUserAchievements = vi.fn(async () => ({ earned: [] as string[], counts: {}, updatedAt: undefined }))

  return {
    store,
    adminDb,
    holdPurchased,
    grantCredits,
    getUserAchievements,
    setFailNextSet: () => { failNextSet = true },
  }
})

vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))
vi.mock('@/lib/credit-manager', () => ({
  CreditManager: { holdPurchased: h.holdPurchased, grantCredits: h.grantCredits },
}))
vi.mock('@/lib/firestore-helpers', () => ({ getUserAchievements: h.getUserAchievements }))

import { adoptOrSwitchPal, ownedSpeciesFrom } from '@/lib/pal-adoption'
import { PAL_ADOPTION_COST } from '@/lib/pet'

beforeEach(() => {
  h.store.clear()
  h.holdPurchased.mockClear().mockResolvedValue(true)
  h.grantCredits.mockClear()
  h.getUserAchievements.mockClear().mockResolvedValue({ earned: [], counts: {}, updatedAt: undefined })
})

describe('ownedSpeciesFrom — grandfathering', () => {
  it('an absent list means the current pal is theirs', () => {
    expect(ownedSpeciesFrom(undefined, 'bird')).toEqual(['bird'])
    expect(ownedSpeciesFrom({ petSpecies: 'dragon' }, 'dragon')).toEqual(['dragon'])
  })

  it('the current pal is always included even if the stored list omits it', () => {
    expect(ownedSpeciesFrom({ petOwnedSpecies: ['cat'] }, 'bird')).toEqual(['bird', 'cat'])
  })
})

describe('adoptOrSwitchPal', () => {
  it('switching back to an owned pal is free — no credits touched', async () => {
    h.store.set('userSettings/u1', { petSpecies: 'bird', petOwnedSpecies: ['bird', 'dragon'] })
    const res = await adoptOrSwitchPal('u1', 'dragon')
    expect(res).toEqual({ ok: true, adopted: false })
    expect(h.holdPurchased).not.toHaveBeenCalled()
    expect(h.store.get('userSettings/u1')?.petSpecies).toBe('dragon')
  })

  it('a NEW pal — even a free-tier species — must be bought', async () => {
    h.store.set('userSettings/u1', { petSpecies: 'bird' }) // owns only bird (grandfathered)
    const res = await adoptOrSwitchPal('u1', 'dragon')
    expect(res).toEqual({ ok: true, adopted: true })
    expect(h.holdPurchased).toHaveBeenCalledWith('u1', PAL_ADOPTION_COST)
    const settings = h.store.get('userSettings/u1')
    expect(settings?.petSpecies).toBe('dragon')
    expect(settings?.petOwnedSpecies).toEqual(['bird', 'dragon'])
  })

  it('insufficient credits → 402 and nothing changes', async () => {
    h.holdPurchased.mockResolvedValueOnce(false)
    h.store.set('userSettings/u1', { petSpecies: 'bird' })
    const res = await adoptOrSwitchPal('u1', 'dragon')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(402)
    expect(h.store.get('userSettings/u1')?.petSpecies).toBe('bird')
  })

  it('an achievement-gated species rejects BEFORE any charge', async () => {
    h.store.set('userSettings/u1', { petSpecies: 'bird' })
    const res = await adoptOrSwitchPal('u1', 'wisp') // needs secret_keeper
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
    expect(h.holdPurchased).not.toHaveBeenCalled()
  })

  it('the gate opens once the achievement is earned (then the price applies)', async () => {
    h.getUserAchievements.mockResolvedValue({ earned: ['secret_keeper'], counts: {}, updatedAt: undefined })
    h.store.set('userSettings/u1', { petSpecies: 'bird' })
    const res = await adoptOrSwitchPal('u1', 'wisp')
    expect(res).toEqual({ ok: true, adopted: true })
    expect(h.holdPurchased).toHaveBeenCalledWith('u1', PAL_ADOPTION_COST)
  })

  it('a failed adoption write refunds the held credits', async () => {
    h.store.set('userSettings/u1', { petSpecies: 'bird' })
    h.setFailNextSet()
    const res = await adoptOrSwitchPal('u1', 'dragon')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(500)
    expect(h.grantCredits).toHaveBeenCalledWith('u1', PAL_ADOPTION_COST)
  })
})
