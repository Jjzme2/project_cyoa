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
