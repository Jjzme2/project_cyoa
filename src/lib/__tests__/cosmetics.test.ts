import { describe, it, expect } from 'vitest'
import { FRAME_SKINS, findFrame, isFrameUnlocked } from '@/lib/cosmetics'
import { ACHIEVEMENT_DEFS } from '@/types'

describe('cosmetics', () => {
  it('the default frame is always unlocked', () => {
    const def = findFrame('default')
    expect(isFrameUnlocked(def, [])).toBe(true)
  })

  it('an achievement-gated frame is locked until earned', () => {
    const bronze = findFrame('bronze')
    expect(bronze.unlockedBy).toBe('first_step')
    expect(isFrameUnlocked(bronze, [])).toBe(false)
    expect(isFrameUnlocked(bronze, ['first_step'])).toBe(true)
  })

  it('falls back to the default frame for an unknown id', () => {
    expect(findFrame('nonexistent').id).toBe('default')
    expect(findFrame(undefined).id).toBe('default')
  })

  it('every frame has a unique id and a non-empty ring class', () => {
    const ids = FRAME_SKINS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of FRAME_SKINS) expect(f.ringClassName.length).toBeGreaterThan(0)
  })

  it('every unlockedBy references a real achievement id', () => {
    const realIds = new Set(ACHIEVEMENT_DEFS.map((d) => d.id))
    for (const f of FRAME_SKINS) {
      if (f.unlockedBy) expect(realIds.has(f.unlockedBy)).toBe(true)
    }
  })
})
