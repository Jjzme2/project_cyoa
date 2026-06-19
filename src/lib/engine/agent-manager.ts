import { GOAPAgent, AgentMemory, WorldState } from '@/types/goap';
import { GOAPPlanner } from './goap-planner';
import { getActionsFromIds } from './action-library';

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
        const prose = nextAction.narrativeTemplate.replace(/\{\{agent\.name\}\}/g, `The character (${agent.characterId})`);
        narrativeOutputs.push(prose);
        agent.currentPlan?.shift();
      } else if (!plan) {
        narrativeOutputs.push(`The character (${agent.characterId}) stands still, doing nothing in particular.`);
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
