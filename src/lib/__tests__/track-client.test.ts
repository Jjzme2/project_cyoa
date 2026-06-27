import { vi, describe, it, expect, afterEach } from 'vitest'
import { trackEvent } from '@/lib/track-client'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('trackEvent', () => {
  it('skips the request entirely for an anonymous user', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await trackEvent(null, 'story.opened')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts an authed, analytics-channel event to /api/track', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await trackEvent({ getIdToken: async () => 'tok' }, 'ending.reached', {
      props: { storyId: 's1', isNew: true },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/track')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ name: 'ending.reached', channel: 'analytics', props: { storyId: 's1', isNew: true } })
  })

  it('never throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(trackEvent({ getIdToken: async () => 'tok' }, 'x')).resolves.toBeUndefined()
  })
})
