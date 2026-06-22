import { GOAPAction } from '@/types/goap';

/**
 * Pre-defined, reusable GOAP actions that agents can use to build plans.
 * Authors can assign these to characters via their goapConfig.availableActions.
 */
export const DefaultActionLibrary: Record<string, GOAPAction> = {
  // ─── Combat Actions ──────────────────────────────────────────────────────
  'combat_attack_player': {
    id: 'combat_attack_player',
    name: 'Attack Player',
    cost: 5,
    category: 'combat',
    preconditions: { 'player.inSight': true, 'agent.isArmed': true },
    effects: { 'player.underAttack': true },
    narrativeTemplate: '{{agent.name}} lunges forward, weapon drawn, aiming a vicious strike directly at you.'
  },
  'combat_flee': {
    id: 'combat_flee',
    name: 'Flee Combat',
    cost: 3,
    category: 'movement',
    preconditions: { 'player.underAttack': true },
    effects: { 'player.underAttack': false, 'agent.hidden': true },
    narrativeTemplate: '{{agent.name}} turns and scrambles into the shadows, abandoning the fight.'
  },

  // ─── Social Actions ──────────────────────────────────────────────────────
  'social_persuade': {
    id: 'social_persuade',
    name: 'Persuade',
    cost: 4,
    category: 'social',
    preconditions: { 'player.inSight': true, 'agent.hasInformation': true },
    effects: { 'player.trustsAgent': true },
    narrativeTemplate: '{{agent.name}} steps closer, lowering their voice. "You have to believe me," they urge, sharing a critical piece of the puzzle.'
  },
  'social_betray': {
    id: 'social_betray',
    name: 'Betray',
    cost: 2, // Cheap to betray if cunning is high
    category: 'social',
    preconditions: { 'player.trustsAgent': true },
    effects: { 'player.trustsAgent': false, 'agent.hasAdvantage': true },
    narrativeTemplate: 'With a cold smile, {{agent.name}} reveals their true colors, springing a trap you never saw coming.'
  },

  // ─── Survival & Utility ──────────────────────────────────────────────────
  'survival_rest': {
    id: 'survival_rest',
    name: 'Rest',
    cost: 1,
    category: 'survival',
    preconditions: { 'agent.isExhausted': true, 'player.underAttack': false },
    effects: { 'agent.isExhausted': false },
    narrativeTemplate: '{{agent.name}} slumps against the wall, taking a moment to catch their breath and bandage their wounds.'
  },
  'utility_search_area': {
    id: 'utility_search_area',
    name: 'Search Area',
    cost: 3,
    category: 'movement',
    preconditions: { 'player.underAttack': false },
    effects: { 'agent.hasInformation': true },
    narrativeTemplate: '{{agent.name}} meticulously scours the area, turning over rocks and inspecting the surroundings for clues.'
  },
  'utility_observe': {
    id: 'utility_observe',
    name: 'Observe',
    cost: 2,
    category: 'movement',
    preconditions: { 'player.inSight': true },
    effects: { 'agent.hasInformation': true },
    narrativeTemplate: '{{agent.name}} hangs back, watching you with unhurried, calculating eyes, missing nothing.'
  },

  // ─── Alternative trust / advantage paths (drive personality variety) ───────
  'social_offer_aid': {
    id: 'social_offer_aid',
    name: 'Offer Aid',
    cost: 4,
    category: 'social',
    preconditions: { 'player.inSight': true },
    effects: { 'player.trustsAgent': true },
    narrativeTemplate: '{{agent.name}} offers a steadying hand and quiet reassurance, asking nothing in return.'
  },
  'social_intimidate': {
    id: 'social_intimidate',
    name: 'Intimidate',
    cost: 5,
    category: 'social',
    preconditions: { 'player.inSight': true },
    effects: { 'agent.hasAdvantage': true, 'player.fearsAgent': true },
    narrativeTemplate: '{{agent.name}} looms close, voice like cold iron, and the balance of power tilts sharply toward them.'
  }
};

/**
 * Helper to get a list of actual action objects from an array of action IDs.
 */
export function getActionsFromIds(ids: string[]): GOAPAction[] {
  return ids
    .map(id => DefaultActionLibrary[id])
    .filter(action => action !== undefined);
}
