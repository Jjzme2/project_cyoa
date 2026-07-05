import { describe, it, expect } from 'vitest'
import { createDefaultEconomy, setMarketLevels } from '@/lib/engine/economy-manager'

describe('setMarketLevels', () => {
  it('sets supply/demand and recomputes price from the same formula tick uses', () => {
    const economy = createDefaultEconomy()
    setMarketLevels(economy, 'food', { supply: 25, demand: 75 })
    const food = economy.markets.food
    expect(food.supply).toBe(25)
    expect(food.demand).toBe(75)
    // basePrice(5) * (75/25) = 15
    expect(food.currentPrice).toBe(15)
  })

  it('clamps to 0-100', () => {
    const economy = createDefaultEconomy()
    setMarketLevels(economy, 'iron', { supply: -20, demand: 500 })
    expect(economy.markets.iron.supply).toBe(0)
    expect(economy.markets.iron.demand).toBe(100)
  })

  it('only updates the fields provided, leaving the other alone', () => {
    const economy = createDefaultEconomy()
    setMarketLevels(economy, 'cloth', { supply: 80 })
    expect(economy.markets.cloth.supply).toBe(80)
    expect(economy.markets.cloth.demand).toBe(50) // untouched default
  })

  it('does nothing for an unknown commodity', () => {
    const economy = createDefaultEconomy()
    expect(() => setMarketLevels(economy, 'unobtainium', { supply: 10 })).not.toThrow()
  })
})
