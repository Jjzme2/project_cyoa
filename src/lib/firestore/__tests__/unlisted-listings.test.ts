import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Unlisted stories are hidden from public listings (reachable only by direct
 * link). The global bounty board and the rooms lobby both surface story titles,
 * so both must exclude unlisted (and unresolvable) stories or they leak a
 * private story's title and a working link to it.
 */
const h = vi.hoisted(() => {
  const getStoryMock = vi.fn()
  const slotDocs: unknown[] = []
  const roomDocs: unknown[] = []

  const terminal = (docs: unknown[]) => ({ get: async () => ({ docs }) })
  const adminDb = {
    collectionGroup: () => ({
      where: () => ({ orderBy: () => ({ limit: () => terminal(slotDocs) }) }),
    }),
    collection: () => ({
      orderBy: () => ({ limit: () => terminal(roomDocs) }),
    }),
  }
  return { getStoryMock, slotDocs, roomDocs, adminDb }
})

vi.mock('@/lib/firebase-admin', () => ({ adminDb: h.adminDb }))
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))
// bounties.ts reads getStory from '@/lib/firestore/stories'; rooms.ts from the barrel.
vi.mock('@/lib/firestore/stories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/firestore/stories')>()),
  getStory: h.getStoryMock,
}))
vi.mock('@/lib/firestore-helpers', () => ({ getStory: h.getStoryMock, getStoryNode: vi.fn() }))

import { listOpenBounties } from '@/lib/firestore/bounties'
import { listActiveRooms } from '@/lib/rooms'

function slotDoc(storyId: string, slotId: string) {
  return {
    id: slotId,
    ref: { path: `stories/${storyId}/nodes/n1/slots/${slotId}` },
    data: () => ({ bounty: { reward: 5, posterName: 'P', status: 'open', createdAt: '2026-01-01' } }),
  }
}
function roomDoc(id: string, storyId: string) {
  return { id, data: () => ({ storyId, storyTitle: `Title ${storyId}`, status: 'lobby', members: { u1: {} } }) }
}

beforeEach(() => {
  h.slotDocs.length = 0
  h.roomDocs.length = 0
  h.getStoryMock.mockReset()
  h.getStoryMock.mockImplementation(async (id: string) => {
    if (id === 'pub') return { id, title: 'Public', unlisted: false }
    if (id === 'sec') return { id, title: 'Secret', unlisted: true }
    return null // 'gone'
  })
})

describe('listOpenBounties — unlisted exclusion', () => {
  it('drops bounties on unlisted and unresolvable stories', async () => {
    h.slotDocs.push(slotDoc('pub', 's1'), slotDoc('sec', 's2'), slotDoc('gone', 's3'))
    const out = await listOpenBounties(30)
    expect(out.map((b) => b.storyId)).toEqual(['pub'])
    expect(out[0].storyTitle).toBe('Public')
  })
})

describe('listActiveRooms — unlisted exclusion', () => {
  it('drops rooms whose story is unlisted or unresolvable', async () => {
    h.roomDocs.push(roomDoc('r1', 'pub'), roomDoc('r2', 'sec'), roomDoc('r3', 'gone'))
    const out = await listActiveRooms(30)
    expect(out.map((r) => r.storyId)).toEqual(['pub'])
    expect(out[0].memberCount).toBe(1)
  })
})
