import { describe, it, expect, vi, beforeEach } from 'vitest'

const { runTextWaterfallMock } = vi.hoisted(() => ({ runTextWaterfallMock: vi.fn() }))

vi.mock('../waterfall', () => ({
  runTextWaterfall: (...args: unknown[]) => runTextWaterfallMock(...args),
  isBillingOrRateLimitError: () => false,
}))

const { classifyNarrativeMode } = await import('../content')

describe('classifyNarrativeMode', () => {
  beforeEach(() => {
    runTextWaterfallMock.mockReset()
  })

  it('returns the classified mode when the model responds with a valid one', async () => {
    runTextWaterfallMock.mockResolvedValueOnce({ text: '{"mode": "mystery"}' })
    const mode = await classifyNarrativeMode('a detective untangles a locked-room murder', 'u1')
    expect(mode).toBe('mystery')
  })

  it('falls back to dramatic for an unrecognized mode', async () => {
    runTextWaterfallMock.mockResolvedValueOnce({ text: '{"mode": "romcom"}' })
    const mode = await classifyNarrativeMode('two rivals fall in love', 'u1')
    expect(mode).toBe('dramatic')
  })

  it('throws on a non-JSON response, same as the other content generators (caught by the route layer)', async () => {
    runTextWaterfallMock.mockResolvedValueOnce({ text: 'not json at all' })
    await expect(classifyNarrativeMode('anything', 'u1')).rejects.toThrow()
  })
})
