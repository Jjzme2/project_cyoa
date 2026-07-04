import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { generateTextMock, openrouterClientMock, FakeAPICallError } = vi.hoisted(() => {
  class FakeAPICallError extends Error {
    statusCode?: number
    constructor(message: string, statusCode?: number) {
      super(message)
      this.statusCode = statusCode
    }
    static isInstance(e: unknown): e is FakeAPICallError {
      return e instanceof FakeAPICallError
    }
  }
  return {
    generateTextMock: vi.fn(),
    openrouterClientMock: vi.fn((model: string) => ({ __openrouterModel: model })),
    FakeAPICallError,
  }
})

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  APICallError: FakeAPICallError,
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => openrouterClientMock,
}))

const { runTextWaterfall, runImageWaterfall, isBillingOrRateLimitError, TEXT_WATERFALL, IMAGE_WATERFALL } = await import('../waterfall')

describe('runTextWaterfall', () => {
  beforeEach(() => {
    generateTextMock.mockReset()
    openrouterClientMock.mockClear()
    process.env.OPENROUTER_API_KEY = 'test-key'
  })

  it('returns the first tier on success without touching later tiers', async () => {
    generateTextMock.mockResolvedValueOnce({ text: 'hello' })
    const { text, model } = await runTextWaterfall({ prompt: 'p', userId: 'u', maxOutputTokens: 10, feature: 'x' })
    expect(text).toBe('hello')
    expect(model).toBe(TEXT_WATERFALL[0].model)
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })

  it('falls through to the next gateway tier when the first fails for a non-billing reason', async () => {
    generateTextMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ text: 'second tier' })
    const { text, model } = await runTextWaterfall({ prompt: 'p', userId: 'u', maxOutputTokens: 10, feature: 'x' })
    expect(text).toBe('second tier')
    expect(model).toBe(TEXT_WATERFALL[1].model)
  })

  it('falls all the way through to the openrouter tier', async () => {
    generateTextMock
      .mockRejectedValueOnce(new Error('boom1'))
      .mockRejectedValueOnce(new Error('boom2'))
      .mockResolvedValueOnce({ text: 'openrouter tier' })
    const { text, model } = await runTextWaterfall({ prompt: 'p', userId: 'u', maxOutputTokens: 10, feature: 'x' })
    expect(text).toBe('openrouter tier')
    expect(model).toBe(`openrouter/${TEXT_WATERFALL[2].model}`)
    expect(openrouterClientMock).toHaveBeenCalledWith(TEXT_WATERFALL[2].model)
  })

  it('short-circuits on a billing/rate-limit error without trying other tiers', async () => {
    const err = new FakeAPICallError('nope', 402)
    generateTextMock.mockRejectedValueOnce(err)
    await expect(
      runTextWaterfall({ prompt: 'p', userId: 'u', maxOutputTokens: 10, feature: 'x' }),
    ).rejects.toBe(err)
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })

  it('throws the last error once every tier is exhausted', async () => {
    generateTextMock.mockRejectedValue(new Error('always fails'))
    await expect(
      runTextWaterfall({ prompt: 'p', userId: 'u', maxOutputTokens: 10, feature: 'x' }),
    ).rejects.toThrow('always fails')
  })
})

describe('runImageWaterfall', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns the first working tier', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { images: [{ image_url: { url: 'https://img/1' } }] } }] }),
    }) as unknown as typeof fetch

    const { imageUrl, model } = await runImageWaterfall({ prompt: 'p', apiKey: 'k' })
    expect(imageUrl).toBe('https://img/1')
    expect(model).toBe(IMAGE_WATERFALL[0])
  })

  it('falls through to the next model when a tier errors or returns no image', async () => {
    let call = 0
    global.fetch = vi.fn().mockImplementation(async () => {
      call += 1
      if (call === 1) return { ok: false, status: 500, json: async () => ({ error: { message: 'dead' } }) }
      return { ok: true, json: async () => ({ choices: [{ message: { images: [{ image_url: { url: 'https://img/2' } }] } }] }) }
    }) as unknown as typeof fetch

    const { imageUrl, model } = await runImageWaterfall({ prompt: 'p', apiKey: 'k' })
    expect(imageUrl).toBe('https://img/2')
    expect(model).toBe(IMAGE_WATERFALL[1])
  })

  it('throws once every image tier has failed', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as unknown as typeof fetch
    await expect(runImageWaterfall({ prompt: 'p', apiKey: 'k' })).rejects.toThrow()
  })
})

describe('isBillingOrRateLimitError', () => {
  it('is true only for 402/429 APICallErrors', () => {
    expect(isBillingOrRateLimitError(new FakeAPICallError('x', 402))).toBe(true)
    expect(isBillingOrRateLimitError(new FakeAPICallError('x', 429))).toBe(true)
    expect(isBillingOrRateLimitError(new FakeAPICallError('x', 500))).toBe(false)
    expect(isBillingOrRateLimitError(new Error('plain'))).toBe(false)
  })
})
