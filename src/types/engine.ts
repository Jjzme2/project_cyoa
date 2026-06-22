import type { WorldState, AgentMemory } from './goap';
import type { Faction } from './faction';
import type { EconomyState } from './economy';
import type { DirectorState } from '../lib/engine/drama-manager';
import type { RelationshipState } from '../lib/engine/relationship-graph';
import type { ActiveQuest } from './procgen';

export interface EngineState {
  worldState: WorldState; // The node's specific world state (for GOAP)
  agentMemories: Record<string, AgentMemory[]>; // Keyed by characterId
  factions: Record<string, Faction>; // Keyed by factionId
  economy: EconomyState;
  turnCount: number; // Increments every node generation
  director?: DirectorState; // AI Director pacing state
  relationships?: RelationshipState; // Character↔protagonist affinity + gossip
  quest?: ActiveQuest; // The quest arc currently unfolding
}
