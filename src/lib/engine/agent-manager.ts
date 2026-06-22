import { GOAPAgent, AgentMemory, WorldState, GOAPGoal, PersonalityWeights } from '@/types/goap';
import { GOAPPlanner } from './goap-planner';
import { getActionsFromIds } from './action-library';

// ── Deterministic personality / default behaviour ──────────────────────────
// Emergent characters arrive with no authored goapConfig, so we synthesise a
// stable one from the character's name. This is what makes `goapEnabled`
// actually produce living behaviour instead of nothing.

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededPersonality(name: string): PersonalityWeights {
  const rng = makeRng(hashString(`${name}:personality`));
  const r = () => Math.round(rng() * 100) / 100;
  return { aggression: r(), loyalty: r(), cunning: r(), courage: r(), greed: r() };
}

/**
 * A universal behaviour profile for any character. Two competing drives —
 * earning the protagonist's trust vs. seeking the upper hand — are weighted by
 * personality, and the memory system (below) tips the balance based on how the
 * protagonist has treated them. Befriend-then-betray emerges naturally because
 * `social_betray` requires trust first.
 */
export function defaultGoapConfig(name: string): NonNullable<{
  goals: GOAPGoal[];
  availableActions: string[];
  personality: PersonalityWeights;
}> {
  const p = seededPersonality(name);
  const goals: GOAPGoal[] = [
    {
      id: 'earn_trust',
      name: 'Earn the protagonist’s trust',
      priority: 4 + p.loyalty * 3,
      desiredState: { 'player.trustsAgent': true },
      sentiment: 'pro_protagonist',
    },
    {
      id: 'gain_advantage',
      name: 'Gain the upper hand',
      priority: 3 + (p.cunning + p.greed) * 1.5,
      desiredState: { 'agent.hasAdvantage': true },
      sentiment: 'anti_protagonist',
    },
  ];
  return {
    goals,
    availableActions: [
      'utility_search_area',
      'social_persuade',
      'social_betray',
      'combat_attack_player',
      'combat_flee',
      'survival_rest',
    ],
    personality: p,
  };
}

function actionSentiment(category: string): AgentMemory['sentiment'] {
  // Auto-recorded agent actions are logged as neutral continuity; the
  // protagonist-relationship sentiment is driven by authored memory effects.
  void category;
  return 'neutral';
}

export class AgentManager {
  private planner: GOAPPlanner;
  private agents: Map<string, GOAPAgent>;

  constructor(maxPlannerDepth: number = 6) {
    this.planner = new GOAPPlanner(maxPlannerDepth);
    this.agents = new Map();
  }

  public registerAgent(agent: GOAPAgent): void {
    this.agents.set(agent.characterId, agent);
  }

  public getAgent(characterId: string): GOAPAgent | undefined {
    return this.agents.get(characterId);
  }

  /**
   * Records a memory event for an agent.
   * Memories decay over time; newer memories have higher decayWeight.
   */
  public addMemory(characterId: string, memory: AgentMemory): void {
    const agent = this.agents.get(characterId);
    if (!agent) return;
    // Decay all existing memories slightly
    for (const m of agent.memory) {
      m.decayWeight = Math.max(0, m.decayWeight - 0.1);
    }
    // Remove memories that have decayed to nothing
    agent.memory = agent.memory.filter((m) => m.decayWeight > 0);
    agent.memory.push(memory);
  }

  /**
   * Serialises all agent memories for persistence in EngineState.
   */
  public serializeMemories(): Record<string, AgentMemory[]> {
    const out: Record<string, AgentMemory[]> = {};
    for (const [id, agent] of this.agents.entries()) {
      out[id] = [...agent.memory];
    }
    return out;
  }

  /**
   * Restores persisted memories into registered agents.
   */
  public restoreMemories(memories: Record<string, AgentMemory[]>): void {
    for (const [id, mems] of Object.entries(memories)) {
      const agent = this.agents.get(id);
      if (agent) agent.memory = [...mems];
    }
  }

  /**
   * Core turn updater. Re-evaluates goals for all agents given the current world state.
   * Returns narrative descriptions of what each agent decided to do this turn.
   */
  public updateTurn(currentState: WorldState): string[] {
    const narrativeOutputs: string[] = [];

    for (const agent of this.agents.values()) {
      const activeGoal = this.getHighestPriorityGoal(agent, currentState);
      if (!activeGoal) continue;

      const availableActions = getActionsFromIds(agent.availableActions);
      const plan = this.planner.plan(currentState, activeGoal, availableActions, agent.personality);
      agent.currentPlan = plan;

      if (plan && plan.length > 0) {
        const nextAction = plan[0];
        // Apply the action's effects to the live world state so the choice has
        // lasting consequences carried into the next turn (real simulation).
        Object.assign(currentState, nextAction.effects);
        // Log it as continuity memory (also exercises memory persistence/decay).
        this.addMemory(agent.characterId, {
          event: nextAction.name,
          nodeId: '',
          sentiment: actionSentiment(nextAction.category),
          decayWeight: 1,
        });
        const prose = nextAction.narrativeTemplate.replace(/\{\{agent\.name\}\}/g, agent.characterId);
        narrativeOutputs.push(prose);
      }
    }

    return narrativeOutputs;
  }

  /**
   * Selects the highest-priority unmet goal, factoring in dynamic priority
   * and the agent's memory of protagonist interactions (Utility AI layer).
   */
  private getHighestPriorityGoal(agent: GOAPAgent, currentState: WorldState) {
    // Compute net protagonist sentiment from memory (-1..1 range)
    const memorySentimentScore = agent.memory.reduce((acc, m) => {
      const weight = m.decayWeight;
      return acc + (m.sentiment === 'positive' ? weight : m.sentiment === 'negative' ? -weight : 0);
    }, 0);

    let bestGoal = null;
    let highestPriority = -1;

    for (const goal of agent.goals) {
      if (goal.failureState && this.planner.isStateSubset(goal.failureState, currentState)) continue;
      if (this.planner.isStateSubset(goal.desiredState, currentState)) continue;

      let priority = goal.dynamicPriority ? goal.dynamicPriority(currentState) : goal.priority;

      // Memory modifier: positive history boosts pro-protagonist goals; negative boosts anti-protagonist goals
      if (goal.sentiment === 'pro_protagonist') {
        priority += memorySentimentScore * 15;
      } else if (goal.sentiment === 'anti_protagonist') {
        priority -= memorySentimentScore * 15;
      }

      if (priority > highestPriority) {
        highestPriority = priority;
        bestGoal = goal;
      }
    }

    return bestGoal;
  }
}
