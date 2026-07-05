import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchProfileState, invalidateProfileState } from '@/lib/profile-state-client'

const SAMPLE = {
  frame: { equipped: 'default', earned: [] },
  pet: { name: 'Inkling', species: 'bird', stage: {}, mood: 'idle', quip: 'hi', achievementsEarned: 0 },
  achievements: { achievements: [], counts: {} },
}

const getToken = () => Promise.resolve('tok')

describe('fetchProfileState — request dedup', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    invalidateProfileState()
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => SAMPLE }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    invalidateProfileState()
  })

  it('shares ONE request across concurrent callers for the same uid', async () => {
    const [a, b, c] = await Promise.all([
      fetchProfileState('u1', getToken),
      fetchProfileState('u1', getToken),
      fetchProfileState('u1', getToken),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(a.frame.equipped).toBe('default')
  })

  it('serves later callers from the resolved cache (still one request)', async () => {
    await fetchProfileState('u1', getToken)
    await fetchProfileState('u1', getToken)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('invalidateProfileState() forces the next call to refetch', async () => {
    await fetchProfileState('u1', getToken)
    invalidateProfileState()
    await fetchProfileState('u1', getToken)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a different uid triggers its own request', async () => {
    await fetchProfileState('u1', getToken)
    await fetchProfileState('u2', getToken)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failed request (next call retries)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    await expect(fetchProfileState('u1', getToken)).rejects.toThrow()
    // cache cleared on failure → a fresh attempt hits fetch again
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => SAMPLE })
    const ok = await fetchProfileState('u1', getToken)
    expect(ok.frame.equipped).toBe('default')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
