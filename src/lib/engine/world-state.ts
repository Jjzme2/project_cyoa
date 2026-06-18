import { WorldState } from '@/types/goap';

export class WorldStateManager {
  private currentState: WorldState;

  constructor(initialState: WorldState = {}) {
    this.currentState = { ...initialState };
  }

  /**
   * Retrieves the current world state.
   */
  public getState(): WorldState {
    return { ...this.currentState };
  }

  /**
   * Updates the world state with a partial state object.
   */
  public applyEffects(effects: Partial<WorldState>): void {
    this.currentState = { ...this.currentState, ...effects } as WorldState;
  }

  /**
   * Sets a specific state key to a value.
   */
  public setStateValue(key: string, value: string | number | boolean): void {
    this.currentState[key] = value;
  }

  /**
   * Gets a specific state value.
   */
  public getStateValue(key: string): string | number | boolean | undefined {
    return this.currentState[key];
  }

  /**
   * Replaces the entire state (used for restoring saves).
   */
  public restoreState(state: WorldState): void {
    this.currentState = { ...state };
  }

  /**
   * Clears the state.
   */
  public clear(): void {
    this.currentState = {};
  }
}
