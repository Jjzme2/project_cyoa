import { describe, it, expect } from 'vitest'
import { buildWorldPulse, tensionLabel, hasPulse } from '@/lib/engine/world-pulse'

describe('buildWorldPulse', () => {
  it('reads tension from the director and clamps to 0..1', () => {
    expect(buildWorldPulse({}, { director: { tension: 0.6 } }).tension).toBe(0.6)
    expect(buildWorldPulse({}, { director: { tension: 1.5 } }).tension).toBe(1)
    expect(buildWorldPulse({}, undefined).tension).toBe(0)
  })

  it('includes only the non-empty narrative strings', () => {
    const p = buildWorldPulse(
      { factionStatus: 'House A rises', economySummary: '   ', relationshipSummary: 'Kael has grown cold' },
      { director: { tension: 0.4 } },
    )
    expect(p.factions).toBe('House A rises')
    expect(p.economy).toBeUndefined() // whitespace dropped
    expect(p.cast).toBe('Kael has grown cold')
  })
})

describe('tensionLabel', () => {
  it('maps levels to labels', () => {
    expect(tensionLabel(0.1)).toBe('Calm')
    expect(tensionLabel(0.35)).toBe('Stirring')
    expect(tensionLabel(0.6)).toBe('Tense')
    expect(tensionLabel(0.9)).toBe('At a knife’s edge')
  })
})

describe('hasPulse', () => {
  it('is false for empty/zero pulses, true when there is something to show', () => {
    expect(hasPulse(undefined)).toBe(false)
    expect(hasPulse({ tension: 0 })).toBe(false)
    expect(hasPulse({ tension: 0.3 })).toBe(true)
    expect(hasPulse({ tension: 0, factions: 'War brews' })).toBe(true)
  })
})
