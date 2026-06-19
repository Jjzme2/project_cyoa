export type CommodityCategory = 'food' | 'raw_material' | 'manufactured' | 'luxury' | 'magical' | 'military';

export interface Commodity {
  id: string;
  name: string;
  category: CommodityCategory;
  basePrice: number;
  description: string;
}

export interface MarketState {
  commodityId: string;
  supply: number;  // Relative supply level (0-100)
  demand: number;  // Relative demand level (0-100)
  currentPrice: number; // dynamically calculated
}

export interface EconomyState {
  globalWealth: number; // General prosperity of the world
  markets: Record<string, MarketState>; // Keyed by commodityId
}

/**
 * A rule that modifies a reader resource when a commodity crosses a market threshold.
 * Authors configure these on a Story so trade has mechanical consequences.
 */
export interface EconomyResourceEffect {
  /** Commodity whose price triggers this rule (e.g. 'food'). */
  commodityId: string
  /** 'scarce' fires when currentPrice > 1.5× base; 'cheap' fires when < 0.5× base. */
  condition: 'scarce' | 'cheap'
  /** The Story resource to modify (must match a ResourceDefinition.name). */
  resourceName: string
  operator: '=' | '+=' | '-='
  value: number
}
