import { describe, it, expect } from 'vitest'
import { resolveAmbientSound } from '@/components/book/book-viewer-internals'
import type { ReadingTheme } from '@/types'

const theme = (overrides: Partial<ReadingTheme> = {}): ReadingTheme => ({
  pageStyle: 'parchment',
  ambientEffect: 'rain',
  ...overrides,
})

describe('resolveAmbientSound', () => {
  it('defaults to matching the visual when no mode is set', () => {
    expect(resolveAmbientSound(theme())).toBe('rain')
  })

  it('is silent when the mode is off, regardless of the visual', () => {
    expect(resolveAmbientSound(theme({ ambientSoundMode: 'off' }))).toBe('none')
  })

  it('auto mode falls back to the visual when no scene cue is given', () => {
    expect(resolveAmbientSound(theme({ ambientSoundMode: 'auto' }))).toBe('rain')
  })

  it('auto mode prefers a detected scene cue over the visual', () => {
    expect(resolveAmbientSound(theme({ ambientSoundMode: 'auto' }), 'snow')).toBe('snow')
  })

  it('match mode ignores a scene cue even if one is given', () => {
    expect(resolveAmbientSound(theme({ ambientSoundMode: 'match' }), 'snow')).toBe('rain')
  })

  it('handles a missing theme gracefully', () => {
    expect(resolveAmbientSound(null)).toBe('none')
    expect(resolveAmbientSound(undefined)).toBe('none')
  })
})
