import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the telemetry channel so we assert on emitted events without touching
// Firestore. Must be declared before importing the module under test.
const trackMock = vi.fn()
vi.mock('@/lib/telemetry', () => ({
  analytics: { track: (...args: unknown[]) => trackMock(...args) },
}))

import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'

describe('generation-telemetry', () => {
  beforeEach(() => trackMock.mockClear())

  it('emits generation.completed with kind, credits and source', () => {
    trackGenerationCompleted({ kind: 'chapter', credits: 3, source: 'purchased', uid: 'u1' })
    expect(trackMock).toHaveBeenCalledTimes(1)
    const [name, opts] = trackMock.mock.calls[0]
    expect(name).toBe('generation.completed')
    expect(opts.uid).toBe('u1')
    expect(opts.props).toMatchObject({ kind: 'chapter', credits: 3, source: 'purchased' })
  })

  it('emits generation.failed with a categorized reason', () => {
    trackGenerationFailed({ kind: 'cover', credits: 3, source: 'daily', reason: 'image_failed' })
    const [name, opts] = trackMock.mock.calls[0]
    expect(name).toBe('generation.failed')
    expect(opts.props).toMatchObject({ kind: 'cover', credits: 3, reason: 'image_failed' })
  })

  it('merges extra context into the props', () => {
    trackGenerationCompleted({
      kind: 'saga',
      credits: 4,
      uid: 'u2',
      context: { worldId: 'w1', entryPoints: 4 },
    })
    const [, opts] = trackMock.mock.calls[0]
    expect(opts.props).toMatchObject({ kind: 'saga', credits: 4, worldId: 'w1', entryPoints: 4 })
  })

  it('does not throw when uid/source are omitted', () => {
    expect(() => trackGenerationCompleted({ kind: 'assist', credits: 1 })).not.toThrow()
    expect(trackMock).toHaveBeenCalledTimes(1)
  })
})
