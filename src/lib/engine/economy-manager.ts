import { EconomyState, MarketState, Commodity, EconomyResourceEffect } from '@/types/economy';
import type { ChoiceEffect } from '@/types';

export const DEFAULT_COMMODITIES: Commodity[] = [
  { id: 'food',       name: 'Food',       category: 'food',          basePrice: 5,  description: 'Essential provisions' },
  { id: 'iron',       name: 'Iron',       category: 'raw_material',  basePrice: 12, description: 'Ore and ingots' },
  { id: 'magic_dust', name: 'Magic Dust', category: 'magical',       basePrice: 50, description: 'Crystallised arcane energy' },
  { id: 'lumber',     name: 'Lumber',     category: 'raw_material',  basePrice: 8,  description: 'Timber and construction materials' },
  { id: 'cloth',      name: 'Cloth',      category: 'manufactured',  basePrice: 10, description: 'Woven textiles and garments' },
  { id: 'weapons',    name: 'Weapons',    category: 'military',      basePrice: 30, description: 'Blades, bows, and armour' },
];

/** Builds a fresh default economy state at market equilibrium. */
export function createDefaultEconomy(): EconomyState {
  const markets: Record<string, MarketState> = {};
  for (const c of DEFAULT_COMMODITIES) {
    markets[c.id] = { commodityId: c.id, supply: 50, demand: 50, currentPrice: c.basePrice };
  }
  return { globalWealth: 50, markets };
}

function recalculatePrices(economy: EconomyState): void {
  for (const c of DEFAULT_COMMODITIES) {
    const market = economy.markets[c.id];
    if (!market) continue;
    const ratio = market.demand / Math.max(1, market.supply);
    market.currentPrice = Math.round(c.basePrice * ratio * 10) / 10;
  }
}

/**
 * Directly set a market's supply/demand (clamped 0-100) and recompute its
 * price from the same formula `tick` uses — for callers that manually drive
 * the economy (e.g. a sandbox) rather than letting it drift turn by turn.
 */
export function setMarketLevels(
  economy: EconomyState,
  commodityId: string,
  updates: { supply?: number; demand?: number },
): void {
  const market = economy.markets[commodityId];
  if (!market) return;
  if (updates.supply !== undefined) market.supply = Math.max(0, Math.min(100, updates.supply));
  if (updates.demand !== undefined) market.demand = Math.max(0, Math.min(100, updates.demand));
  recalculatePrices(economy);
}

export interface EconomyTickResult {
  significantChanges: string[];
}

export class EconomyManager {
  /**
   * Advances the economy by one turn.
   * Applies natural drift towards equilibrium and recalculates prices.
   * Returns any narratively significant price swings.
   */
  public tick(economy: EconomyState): EconomyTickResult {
    const significantChanges: string[] = [];

    // Snapshot old prices before drift
    const oldPrices: Record<string, number> = {};
    for (const [id, m] of Object.entries(economy.markets)) {
      oldPrices[id] = m.currentPrice;
    }

    // Natural drift: supply and demand inch towards equilibrium each turn
    for (const market of Object.values(economy.markets)) {
      market.supply  = Math.max(5, Math.min(100, market.supply  + (50 - market.supply)  * 0.05));
      market.demand  = Math.max(5, Math.min(100, market.demand  + (50 - market.demand)  * 0.05));
    }

    recalculatePrices(economy);

    // Detect significant price swings (>30% vs last turn)
    for (const c of DEFAULT_COMMODITIES) {
      const market = economy.markets[c.id];
      if (!market) continue;
      const old = oldPrices[c.id] ?? market.currentPrice;
      const change = market.currentPrice / Math.max(0.1, old);
      if (change > 1.3) {
        significantChanges.push(`The price of ${c.name} has skyrocketed due to scarcity.`);
      } else if (change < 0.7) {
        significantChanges.push(`${c.name} floods the market, crashing its value.`);
      }
    }

    return { significantChanges };
  }

  /**
   * Evaluates economy threshold rules against the current market and returns
   * the ChoiceEffects that should be applied to player resources this turn.
   * Returned effects are deduplicated per resource (last rule wins for '=').
   */
  public static computeEconomyEffects(
    economy: EconomyState,
    rules: EconomyResourceEffect[],
  ): ChoiceEffect[] {
    const triggered: ChoiceEffect[] = []
    for (const rule of rules) {
      const market = economy.markets[rule.commodityId]
      const commodity = DEFAULT_COMMODITIES.find((c) => c.id === rule.commodityId)
      if (!market || !commodity) continue
      const ratio = market.currentPrice / commodity.basePrice
      const fires = rule.condition === 'scarce' ? ratio > 1.5 : ratio < 0.5
      if (fires) {
        triggered.push({ resourceName: rule.resourceName, operator: rule.operator, value: rule.value })
      }
    }
    return triggered
  }

  /** Returns a short human-readable summary of notable market conditions. */
  public static getSummary(economy: EconomyState): string {
    const notable: string[] = [];
    for (const c of DEFAULT_COMMODITIES) {
      const market = economy.markets[c.id];
      if (!market) continue;
      const ratio = market.currentPrice / c.basePrice;
      if (ratio > 1.5) notable.push(`${c.name} is scarce (${market.currentPrice.toFixed(1)}g)`);
      else if (ratio < 0.5) notable.push(`${c.name} is flooding the market (${market.currentPrice.toFixed(1)}g)`);
    }
    return notable.length > 0 ? `Market Conditions: ${notable.join('; ')}.` : '';
  }
}
