import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveSheet } from '../PalSprite'

/**
 * The sprite resolver must NOT negative-cache a "not found yet" result for the
 * rest of the browser session — art is added over time (an author drops a new
 * PNG into public/pals/), so a species/stage with no art on first mount must
 * be retried on the NEXT mount rather than permanently remembered as missing.
 * Successful resolutions ARE memoized (a found sheet never disappears).
 *
 * This exercises the exact bug reported: sprites still showing the emoji
 * fallback after new sheets were added, without a hard page reload.
 */

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  private _src = ''
  get src() { return this._src }
  set src(value: string) {
    this._src = value
    queueMicrotask(() => {
      const dims = FakeImage.registry.get(value)
      if (dims) {
        this.naturalWidth = dims.w
        this.naturalHeight = dims.h
        this.onload?.()
      } else {
        this.onerror?.()
      }
    })
  }
  static registry = new Map<string, { w: number; h: number }>()
  static probeCount = 0
}

beforeEach(() => {
  FakeImage.registry.clear()
  FakeImage.probeCount = 0
  vi.stubGlobal('Image', class extends FakeImage {
    set src(value: string) {
      FakeImage.probeCount++
      super.src = value
    }
    get src() { return super.src }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveSheet — no negative caching', () => {
  it('returns null when no candidate exists yet', async () => {
    const info = await resolveSheet('cat', 2)
    expect(info).toBeNull()
  })

  it('finds art added AFTER an earlier miss (no hard reload required)', async () => {
    const missed = await resolveSheet('unlisted-species' as never, 5)
    expect(missed).toBeNull()

    // Art shows up between "mounts" — the exact candidate PalSprite tries first.
    FakeImage.registry.set('/pals/unlisted-species-l5.png', { w: 384, h: 480 })

    const found = await resolveSheet('unlisted-species' as never, 5)
    expect(found).not.toBeNull()
    expect(found?.url).toBe('/pals/unlisted-species-l5.png')
    expect(found?.frames).toBe(4) // 384 / (480/5) = 4
  })

  it('memoizes a successful resolution (no re-probing once found)', async () => {
    FakeImage.registry.set('/pals/dragon-l7.png', { w: 384, h: 480 })
    const first = await resolveSheet('dragon', 7)
    expect(first).not.toBeNull()

    const probesBefore = FakeImage.probeCount
    const second = await resolveSheet('dragon', 7)
    expect(second).toEqual(first)
    expect(FakeImage.probeCount).toBe(probesBefore) // no new network probe
  })
})
