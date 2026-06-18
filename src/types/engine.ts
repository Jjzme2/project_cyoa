import type { WorldState, AgentMemory } from './goap';
import type { Faction } from './faction';
import type { EconomyState } from './economy';

export interface EngineState {
  worldState: WorldState; // The node's specific world state (for GOAP)
  agentMemories: Record<string, AgentMemory[]>; // Keyed by characterId
  factions: Record<string, Faction>; // Keyed by factionId
  economy: EconomyState;
  turnCount: number; // Increments every node generation
}
