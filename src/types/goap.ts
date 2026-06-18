export type WorldState = Record<string, boolean | number | string>;

export type ActionCategory = 'combat' | 'social' | 'movement' | 'survival' | 'trade' | 'narrative';

export interface GOAPAction {
  id: string;
  name: string;
  cost: number;
  preconditions: Partial<WorldState>;
  effects: Partial<WorldState>;
  narrativeTemplate: string;
  category: ActionCategory;
}

export interface PersonalityWeights {
  aggression: number;
  loyalty: number;
  cunning: number;
  courage: number;
  greed: number;
}

export interface AgentMemory {
  event: string;
  nodeId: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  decayWeight: number;
}

export interface GOAPGoal {
  id: string;
  name: string;
  priority: number;
  desiredState: Partial<WorldState>;
  failureState?: Partial<WorldState>;
  dynamicPriority?: (ws: WorldState) => number;
  /**
   * Declares how this goal relates to the protagonist.
   * The memory system uses this to boost or suppress the goal based on remembered interactions.
   */
  sentiment?: 'pro_protagonist' | 'anti_protagonist' | 'neutral';
}

export interface GOAPAgent {
  characterId: string;
  goals: GOAPGoal[];
  availableActions: string[];
  personality: PersonalityWeights;
  currentPlan: GOAPAction[] | null;
  memory: AgentMemory[];
}
