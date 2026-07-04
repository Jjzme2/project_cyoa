import { describe, it, expect } from 'vitest'
import { DEFAULT_COVER, rollCover } from '@/components/book/cover-theme'
import type { CoverTheme } from '@/types'
import {
  DEFAULT_WORLD_THEME,
  TONE_ATMOSPHERES,
  themeForTone,
  rollWorldTheme,
  WORLD_EMBLEMS,
  WORLD_PATTERNS,
} from '@/components/world/world-theme'
import { PAGE_STYLES, AMBIENT_EFFECTS } from '@/components/book/ReadingThemePicker'
import { PAGE_PALETTES } from '@/components/book/book-viewer-internals'

const VALID_BORDERS = ['none', 'single', 'double', 'ornate', 'runic', 'thorn', 'celestial', 'vine']
const VALID_PATTERNS = ['none', 'stars', 'grid', 'dots', 'lines', 'diamonds', 'waves', 'crosshatch']

describe('rollCover', () => {
  it('produces a fully-formed, valid cover theme', () => {
    for (let i = 0; i < 50; i++) {
      const t = rollCover(DEFAULT_COVER)
      expect(typeof t.fromColor).toBe('string')
      expect(typeof t.toColor).toBe('string')
      expect(typeof t.accentColor).toBe('string')
      expect(t.icon.length).toBeGreaterThan(0)
      expect(VALID_PATTERNS).toContain(t.pattern)
      expect(VALID_BORDERS).toContain(t.borderFrame)
    }
  })

  it('preserves an existing AI cover image', () => {
    const withImage: CoverTheme = { ...DEFAULT_COVER, coverImageUrl: 'https://example.com/x.png' }
    expect(rollCover(withImage).coverImageUrl).toBe('https://example.com/x.png')
  })
})

describe('world theme helpers', () => {
  it('has a sane default', () => {
    expect(DEFAULT_WORLD_THEME.emblem.length).toBeGreaterThan(0)
    expect(VALID_PATTERNS).toContain(DEFAULT_WORLD_THEME.pattern)
  })

  it('themeForTone applies a known tone and preserves the border frame', () => {
    const prev = { ...DEFAULT_WORLD_THEME, borderFrame: 'ornate' as const }
    const tuned = themeForTone('Cyberpunk Dystopia', prev)
    expect(tuned).toMatchObject(TONE_ATMOSPHERES['Cyberpunk Dystopia'])
    // The suggestion never touches the frame the author chose.
    expect(tuned.borderFrame).toBe('ornate')
  })

  it('themeForTone leaves an unknown tone untouched', () => {
    const prev = { ...DEFAULT_WORLD_THEME, emblem: '🛸' }
    expect(themeForTone('Totally Made Up Tone', prev)).toEqual(prev)
  })

  it('every tone suggestion is internally valid', () => {
    for (const s of Object.values(TONE_ATMOSPHERES)) {
      expect(VALID_PATTERNS).toContain(s.pattern)
      expect(s.emblem.length).toBeGreaterThan(0)
      expect(s.fromColor).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('rollWorldTheme stays within the curated vocabulary', () => {
    const emblems = new Set(WORLD_EMBLEMS)
    const patterns = new Set(WORLD_PATTERNS.map((p) => p.id))
    for (let i = 0; i < 50; i++) {
      const t = rollWorldTheme(DEFAULT_WORLD_THEME)
      expect(emblems.has(t.emblem)).toBe(true)
      expect(patterns.has(t.pattern)).toBe(true)
      expect(VALID_BORDERS).toContain(t.borderFrame)
    }
  })
})

describe('reading theme presets', () => {
  it('every PAGE_STYLES entry has a matching PAGE_PALETTES palette', () => {
    for (const s of PAGE_STYLES) {
      expect(PAGE_PALETTES[s.id]).toBeDefined()
      expect(PAGE_PALETTES[s.id].bg).toBe(s.bg)
      expect(PAGE_PALETTES[s.id].text).toBe(s.text)
    }
  })

  it('has no duplicate page style or ambient effect ids', () => {
    expect(new Set(PAGE_STYLES.map((s) => s.id)).size).toBe(PAGE_STYLES.length)
    expect(new Set(AMBIENT_EFFECTS.map((e) => e.id)).size).toBe(AMBIENT_EFFECTS.length)
  })
})
