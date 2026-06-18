import { WorldState, GOAPAction, GOAPGoal, PersonalityWeights } from '@/types/goap';

export interface PlanNode {
  state: WorldState;
  action: GOAPAction | null;
  parent: PlanNode | null;
  gCost: number; // Cost so far
  hCost: number; // Heuristic distance to goal
}

export class GOAPPlanner {
  private maxDepth: number;

  constructor(maxDepth: number = 6) {
    this.maxDepth = maxDepth;
  }

  /**
   * Plans a sequence of actions to achieve the goal state from the current state.
   * Returns an array of actions, or null if no valid plan was found.
   */
  public plan(
    currentState: WorldState,
    goal: GOAPGoal,
    availableActions: GOAPAction[],
    personality?: PersonalityWeights
  ): GOAPAction[] | null {
    // If the goal is already met, no plan needed (empty array = success, do nothing)
    if (this.isStateSubset(goal.desiredState, currentState)) {
      return [];
    }

    const startNode: PlanNode = {
      state: currentState,
      action: null,
      parent: null,
      gCost: 0,
      hCost: this.calculateHeuristic(currentState, goal.desiredState),
    };

    const openList: PlanNode[] = [startNode];
    const closedList: Set<string> = new Set();

    while (openList.length > 0) {
      // Pop the node with the lowest fCost (gCost + hCost)
      openList.sort((a, b) => (a.gCost + a.hCost) - (b.gCost + b.hCost));
      const currentNode = openList.shift()!;

      // Check depth limit
      const currentDepth = this.getDepth(currentNode);
      if (currentDepth > this.maxDepth) {
        continue;
      }

      // Check if we reached the goal
      if (this.isStateSubset(goal.desiredState, currentNode.state)) {
        return this.buildPlanFromNode(currentNode);
      }

      const stateHash = this.hashState(currentNode.state);
      if (closedList.has(stateHash)) {
        continue;
      }
      closedList.add(stateHash);

      // Evaluate all possible actions
      for (const action of availableActions) {
        if (this.isStateSubset(action.preconditions, currentNode.state)) {
          // Apply action effects to create new state
          const nextState = { ...currentNode.state, ...action.effects } as WorldState;
          
          const actionCost = this.calculateActionCost(action, personality);
          const nextNode: PlanNode = {
            state: nextState,
            action: action,
            parent: currentNode,
            gCost: currentNode.gCost + actionCost,
            hCost: this.calculateHeuristic(nextState, goal.desiredState),
          };

          openList.push(nextNode);
        }
      }
    }

    return null; // No plan found
  }

  /**
   * Checks if 'subset' is fully contained within 'state'.
   * All keys in subset must exist in state, and their values must match.
   */
  public isStateSubset(subset: Partial<WorldState>, state: WorldState): boolean {
    for (const key in subset) {
      if (subset[key] !== state[key]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Simple heuristic: count the number of unmatched goal conditions.
   */
  private calculateHeuristic(state: WorldState, goalState: Partial<WorldState>): number {
    let distance = 0;
    for (const key in goalState) {
      if (state[key] !== goalState[key]) {
        distance += 1;
      }
    }
    return distance;
  }

  /**
   * Calculates the modified cost of an action based on agent personality.
   */
  private calculateActionCost(action: GOAPAction, personality?: PersonalityWeights): number {
    let cost = action.cost;
    
    if (!personality) return cost;

    // Modify cost based on action category and personality
    switch (action.category) {
      case 'combat':
        // High aggression lowers combat cost (more likely to choose violence)
        cost -= (personality.aggression * 2);
        // Low courage increases combat cost
        cost += ((1 - personality.courage) * 2);
        break;
      case 'social':
        // Can be complex, maybe based on cunning
        break;
      case 'movement':
        // Cowardly agents might prefer movement (fleeing) if courage is low
        break;
      // Add more personality modifiers as needed
    }

    // Ensure cost never goes negative to prevent infinite loops in A*
    return Math.max(0.1, cost);
  }

  private getDepth(node: PlanNode): number {
    let depth = 0;
    let curr: PlanNode | null = node;
    while (curr) {
      depth++;
      curr = curr.parent;
    }
    return depth;
  }

  private buildPlanFromNode(node: PlanNode): GOAPAction[] {
    const plan: GOAPAction[] = [];
    let curr: PlanNode | null = node;
    
    while (curr && curr.action) {
      plan.unshift(curr.action);
      curr = curr.parent;
    }
    
    return plan;
  }

  private hashState(state: WorldState): string {
    // Sort keys to ensure consistent hashing
    const keys = Object.keys(state).sort();
    return keys.map(k => `${k}:${state[k]}`).join('|');
  }
}
