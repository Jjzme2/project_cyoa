import { describe, it, expect } from 'vitest'
import { SeededRNG } from '@/lib/engine/seed-rng'

describe('SeededRNG', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = new SeededRNG(12345)
    const b = new SeededRNG(12345)
    const seqA = Array.from({ length: 10 }, () => a.nextFloat())
    const seqB = Array.from({ length: 10 }, () => b.nextFloat())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = new SeededRNG(1)
    const b = new SeededRNG(2)
    const seqA = Array.from({ length: 10 }, () => a.nextFloat())
    const seqB = Array.from({ length: 10 }, () => b.nextFloat())
    expect(seqA).not.toEqual(seqB)
  })

  it('nextFloat stays within [0, 1)', () => {
    const rng = new SeededRNG(99)
    for (let i = 0; i < 1000; i++) {
      const f = rng.nextFloat()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
    }
  })

  it('nextInt stays within the inclusive range', () => {
    const rng = new SeededRNG(7)
    for (let i = 0; i < 1000; i++) {
      const n = rng.nextInt(3, 8)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(8)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('nextInt with a single-value range always returns that value', () => {
    const rng = new SeededRNG(42)
    for (let i = 0; i < 20; i++) {
      expect(rng.nextInt(5, 5)).toBe(5)
    }
  })

  it('pick returns an element of the array', () => {
    const rng = new SeededRNG(2024)
    const arr = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr))
    }
  })

  it('pick on a single-element array returns that element', () => {
    const rng = new SeededRNG(1)
    expect(rng.pick(['only'])).toBe('only')
  })

  describe('hashString', () => {
    it('is deterministic', () => {
      expect(SeededRNG.hashString('hello')).toBe(SeededRNG.hashString('hello'))
    })

    it('is non-negative', () => {
      for (const s of ['', 'a', 'a long string with spaces', 'symbols!@#$']) {
        expect(SeededRNG.hashString(s)).toBeGreaterThanOrEqual(0)
      }
    })

    it('maps different strings to (generally) different hashes', () => {
      expect(SeededRNG.hashString('foo')).not.toBe(SeededRNG.hashString('bar'))
    })
  })

  describe('deriveSeed', () => {
    it('is deterministic for the same base and salt', () => {
      expect(SeededRNG.deriveSeed(100, 'factions')).toBe(SeededRNG.deriveSeed(100, 'factions'))
    })

    it('produces different sub-seeds for different salts', () => {
      expect(SeededRNG.deriveSeed(100, 'factions')).not.toBe(SeededRNG.deriveSeed(100, 'characters'))
    })

    it('derived seeds drive distinct sequences', () => {
      const s1 = SeededRNG.deriveSeed(100, 'a')
      const s2 = SeededRNG.deriveSeed(100, 'b')
      const r1 = new SeededRNG(s1).nextFloat()
      const r2 = new SeededRNG(s2).nextFloat()
      expect(r1).not.toBe(r2)
    })
  })
})
