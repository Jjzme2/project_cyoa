import { describe, it, expect } from 'vitest'
import {
  PAL_ANIMATIONS,
  SHEET_ROWS,
  rowIndexFor,
  ANIMATION_FPS,
  spriteSheetCandidates,
  animationForMood,
  companionAnimation,
  SCARED_TENSION,
} from '@/lib/pal-sprites'
import { PET_SPECIES } from '@/lib/pet'

describe('sheet convention', () => {
  it('locks the five-row order the art targets: idle, sleep, scared, excited, sad', () => {
    expect(PAL_ANIMATIONS).toEqual(['idle', 'sleep', 'scared', 'excited', 'sad'])
    expect(SHEET_ROWS).toBe(5)
    expect(rowIndexFor('idle')).toBe(0)
    expect(rowIndexFor('sad')).toBe(4)
  })

  it('defines a playback speed for every animation', () => {
    for (const a of PAL_ANIMATIONS) expect(ANIMATION_FPS[a]).toBeGreaterThan(0)
  })
})

describe('spriteSheetCandidates — drop-in art lookup', () => {
  it('tries the current stage, earlier stages (closest first), then the base sheet', () => {
    expect(spriteSheetCandidates('cat', 6)).toEqual([
      '/pals/cat-l6.png',
      '/pals/cat-l4.png',
      '/pals/cat-l2.png',
      '/pals/cat-l1.png',
      '/pals/cat.png',
    ])
  })

  it('a hatchling only looks for its own art and the base sheet', () => {
    expect(spriteSheetCandidates('bird', 1)).toEqual(['/pals/bird-l1.png', '/pals/bird.png'])
  })

  it('works for every species, present or future-shaped', () => {
    for (const s of PET_SPECIES) {
      const urls = spriteSheetCandidates(s.id, 10)
      expect(urls[urls.length - 1]).toBe(`/pals/${s.id}.png`)
      expect(urls[0]).toBe(`/pals/${s.id}-l10.png`)
    }
  })
})

describe('animation selection', () => {
  it('maps moods to resting animations', () => {
    expect(animationForMood('thrilled')).toBe('excited')
    expect(animationForMood('active')).toBe('idle')
    expect(animationForMood('idle')).toBe('sad')
    expect(animationForMood('dozing')).toBe('sleep')
  })

  it('companion priority: pat > ending > scared > sleep > mood', () => {
    const base = { mood: 'active' as const, isEnding: false, inactive: false, patted: false }
    expect(companionAnimation({ ...base })).toBe('idle')
    expect(companionAnimation({ ...base, inactive: true })).toBe('sleep')
    expect(companionAnimation({ ...base, inactive: true, tension: 0.9 })).toBe('scared')
    expect(companionAnimation({ ...base, tension: 0.9, isEnding: true })).toBe('excited')
    expect(companionAnimation({ ...base, tension: 0.9, patted: true })).toBe('excited')
  })

  it('fear starts exactly at the tension threshold', () => {
    const base = { mood: 'active' as const, isEnding: false, inactive: false, patted: false }
    expect(companionAnimation({ ...base, tension: SCARED_TENSION - 0.01 })).toBe('idle')
    expect(companionAnimation({ ...base, tension: SCARED_TENSION })).toBe('scared')
    expect(companionAnimation({ ...base })).toBe('idle') // tension unknown → calm
  })
})
