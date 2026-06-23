export type FactionAlignment = 'lawful_good' | 'neutral_good' | 'chaotic_good' | 'lawful_neutral' | 'true_neutral' | 'chaotic_neutral' | 'lawful_evil' | 'neutral_evil' | 'chaotic_evil';

export interface FactionResource {
  commodityId: string;
  amount: number;
}

export interface FactionRelationship {
  factionId: string;
  sentiment: number; // -100 (Hostile) to 100 (Allied)
}

/** Minimal shared state visible to faction action handlers. Avoids circular imports with EngineState. */
export interface FactionActionContext {
  factions: Record<string, Faction>;
  economy: {
    globalWealth: number;
    markets: Record<string, { commodityId: string; supply: number; demand: number; currentPrice: number }>;
  };
  /** Picks phrasing variants so faction events don't read identically every time. */
  pickVariant?: <T>(arr: T[]) => T;
}

export interface FactionAction {
  id: string;
  name: string;
  baseUtility: number;
  evaluateUtility: (faction: Faction, state: FactionActionContext) => number;
  execute: (faction: Faction, state: FactionActionContext) => { narrative: string; effects: Record<string, boolean | number | string> };
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  alignment: FactionAlignment;
  wealth: number;
  influence: number; // 0-100 (Power/reach within the world)
  resources: FactionResource[];
  relationships: FactionRelationship[];
  // Faction traits can be strings like "militaristic", "mercantile", "religious"
  traits: string[]; 
}
