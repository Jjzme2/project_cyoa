import { describe, it, expect } from 'vitest'
import { metEndingCondition } from '@/lib/engine/ending-conditions'
import type { EndingCondition } from '@/types'

const cond = (over: Partial<EndingCondition>): EndingCondition => ({
  resourceName: 'health',
  operator: '<=',
  value: 0,
  type: 'tragic',
  title: 'The Last Breath',
  ...over,
})

describe('metEndingCondition', () => {
  it('returns null with no conditions or resources', () => {
    expect(metEndingCondition(undefined, { health: 0 })).toBeNull()
    expect(metEndingCondition([cond({})], undefined)).toBeNull()
  })

  it('fires when a numeric threshold is crossed', () => {
    expect(metEndingCondition([cond({})], { health: 0 })?.title).toBe('The Last Breath')
    expect(metEndingCondition([cond({})], { health: 5 })).toBeNull()
  })

  it('never fires on an undefined resource (missing ≠ satisfied)', () => {
    expect(metEndingCondition([cond({})], { gold: 3 })).toBeNull()
  })

  it('supports >= for a win condition', () => {
    const win = cond({ resourceName: 'crown', operator: '>=', value: 1, type: 'triumphant', title: 'Crowned' })
    expect(metEndingCondition([win], { crown: 1 })?.type).toBe('triumphant')
    expect(metEndingCondition([win], { crown: 0 })).toBeNull()
  })

  it('supports array contains / string equality', () => {
    const relic = cond({ resourceName: 'inventory', operator: 'contains', value: 'Sunstone', type: 'triumphant', title: 'The Sunstone' })
    expect(metEndingCondition([relic], { inventory: ['Rope', 'Sunstone'] })?.title).toBe('The Sunstone')
    const fate = cond({ resourceName: 'fate', operator: '==', value: 'exiled', type: 'bittersweet', title: 'Exile' })
    expect(metEndingCondition([fate], { fate: 'exiled' })?.type).toBe('bittersweet')
  })

  it('returns the first matching condition', () => {
    const a = cond({ resourceName: 'health', operator: '<=', value: 0, title: 'A' })
    const b = cond({ resourceName: 'gold', operator: '>=', value: 100, title: 'B' })
    expect(metEndingCondition([a, b], { health: 0, gold: 200 })?.title).toBe('A')
  })
})
