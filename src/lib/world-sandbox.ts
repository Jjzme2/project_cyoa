import { FactionManager } from './engine/faction-manager'
import { EconomyManager, createDefaultEconomy, setMarketLevels, DEFAULT_COMMODITIES } from './engine/economy-manager'
import { DifficultyManager } from './engine/difficulty'
import { buildWorldPulse } from './engine/world-pulse'
import type { NarrativeMode } from './engine/narrative-mode'
import type { Faction } from '@/types/faction'
import type { EconomyState } from '@/types/economy'
import type { WorldState } from '@/types/goap'
import type { GenesisFaction, WorldPulse, Protagonist, StoryPathSegment } from '@/types'

/**
 * World Sandbox — a hands-on, non-narrative playground for a world's
 * deterministic systems (factions, economy, tension, custom world facts).
 * Nothing here is persisted server-side, costs credits, or touches any real
 * story: it's the SAME pure simulation engine the real narrative path uses
 * (FactionManager, EconomyManager, DifficultyManager, buildWorldPulse — no
 * AI, no randomness beyond a seeded RNG), driven by direct user control
 * instead of reader choices. See WorldSandbox.tsx for the UI.
 */

export const MAX_EVENT_LOG = 40
export const MAX_SCENE_LOG = 20

/** Who the reader plays as in an AI-narrated sandbox turn — see NarrateOptions. */
export type PlayerMode = 'hero' | 'god'

/**
 * Only meaningful in 'god' mode: whether the world's own people perceive the
 * player's hand at all. `hidden` narrates events as if they arose naturally
 * from the world itself — no one suspects a god; `known` lets characters
 * address, question, resist, or revere the god directly.
 */
export type GodAwareness = 'hidden' | 'known'

/**
 * Sandbox v2's narrative layer: entirely session-local, like the rest of
 * SandboxState — a hero exists only for this sandbox session, never touches
 * the real character registry, and `scenes` is resent to the narrate route
 * each turn instead of being persisted as real Story/StoryNode documents.
 */
export interface NarrativeState {
  playerMode: PlayerMode | null
  /** Only set (and only used) in 'hero' mode — a sandbox-only protagonist. */
  hero?: Protagonist
  /** Only used in 'god' mode. Defaults to 'hidden'. */
  godAwareness: GodAwareness
  /** Accumulated AI-narrated turns, oldest first, capped at MAX_SCENE_LOG. */
  scenes: StoryPathSegment[]
}

export interface SandboxState {
  factions: Record<string, Faction>
  economy: EconomyState
  /** Freeform world facts (the same GOAP WorldState shape) — a generic,
   * world-agnostic control surface for whatever the author imagines. */
  worldState: WorldState
  /** 0..1, directly user-controlled (not derived) — this is a toy, not a sim of the Director. */
  tension: number
  /** Recent tick narration, most recent last, capped. */
  eventLog: string[]
  narrative: NarrativeState
}

/** Fresh sandbox state for a world: its genesis factions if it has them, else
 * seeded defaults from the world's own procedural seed. */
export function initSandboxState(worldSeed: number, genesisFactions?: GenesisFaction[]): SandboxState {
  const factions = genesisFactions?.length
    ? FactionManager.fromGenesis(genesisFactions, worldSeed)
    : FactionManager.generateDefaultFactions(worldSeed)
  return {
    factions,
    economy: createDefaultEconomy(),
    worldState: {},
    tension: 0.2,
    eventLog: [],
    narrative: { playerMode: null, godAwareness: 'hidden', scenes: [] },
  }
}

/**
 * Advance the simulation `ticks` turns, returning both the new state AND the
 * events THIS call generated (uncapped — distinct from the state's own
 * `eventLog`, which is capped at MAX_EVENT_LOG and may have dropped older
 * lines). The narrate route folds `newEvents` into what the AI is told
 * happened this turn — see Sandbox v3's hero/god play loop in
 * WorldSandbox.tsx, which ticks the world every turn instead of leaving
 * "Play it out" and "Advance time" as two disconnected toys.
 *
 * `gentle` genuinely excludes hostile faction actions (see
 * FactionManager.tick) rather than merely hiding their narration — a
 * sandbox shows its work, so "no bad happens here" must hold at the
 * mechanical level, not just in the prose.
 */
export function advanceTicksWithEvents(
  state: SandboxState,
  ticks: number,
  gentle: boolean,
  factionManager: FactionManager,
  economyManager: EconomyManager,
): { state: SandboxState; newEvents: string[] } {
  // FactionManager/EconomyManager.tick() mutate their faction/market objects IN
  // PLACE (by design — see their own docs), so a shallow copy of the top-level
  // maps isn't enough to protect the caller's state: the nested Faction and
  // MarketState objects would still be the SAME references. Deep-clone each one.
  const factions = Object.fromEntries(
    Object.entries(state.factions).map(([id, f]) => [
      id,
      { ...f, relationships: f.relationships.map((r) => ({ ...r })), resources: f.resources.map((r) => ({ ...r })) },
    ]),
  )
  const economy: EconomyState = {
    globalWealth: state.economy.globalWealth,
    markets: Object.fromEntries(Object.entries(state.economy.markets).map(([id, m]) => [id, { ...m }])),
  }
  const newEvents: string[] = []

  for (let i = 0; i < Math.max(0, ticks); i++) {
    const factionResult = factionManager.tick(factions, economy, gentle)
    const economyResult = economyManager.tick(economy)
    newEvents.push(...factionResult.narrativeEvents, ...economyResult.significantChanges)
  }

  const eventLog = [...state.eventLog, ...newEvents].slice(-MAX_EVENT_LOG)
  return { state: { ...state, factions, economy, eventLog }, newEvents }
}

/** Convenience wrapper over {@link advanceTicksWithEvents} for callers that only need the new state. */
export function advanceTicks(
  state: SandboxState,
  ticks: number,
  gentle: boolean,
  factionManager: FactionManager,
  economyManager: EconomyManager,
): SandboxState {
  return advanceTicksWithEvents(state, ticks, gentle, factionManager, economyManager).state
}

/** Directly nudge a faction's wealth or influence, clamped to its normal 0-100(-200) range. */
export function nudgeFactionStat(
  state: SandboxState,
  factionId: string,
  stat: 'wealth' | 'influence',
  delta: number,
): SandboxState {
  const faction = state.factions[factionId]
  if (!faction) return state
  const max = stat === 'wealth' ? 200 : 100
  const next = Math.max(0, Math.min(max, faction[stat] + delta))
  return { ...state, factions: { ...state.factions, [factionId]: { ...faction, [stat]: next } } }
}

/** Directly set how `factionId` feels about `towardId` (-100..100). One-directional by design. */
export function setFactionSentiment(
  state: SandboxState,
  factionId: string,
  towardId: string,
  sentiment: number,
): SandboxState {
  const faction = state.factions[factionId]
  if (!faction) return state
  const clamped = Math.max(-100, Math.min(100, sentiment))
  const relationships = faction.relationships.some((r) => r.factionId === towardId)
    ? faction.relationships.map((r) => (r.factionId === towardId ? { ...r, sentiment: clamped } : r))
    : [...faction.relationships, { factionId: towardId, sentiment: clamped }]
  return { ...state, factions: { ...state.factions, [factionId]: { ...faction, relationships } } }
}

/** Directly set a commodity's supply/demand; price is recomputed from the same formula `tick` uses. */
export function setMarket(state: SandboxState, commodityId: string, updates: { supply?: number; demand?: number }): SandboxState {
  const economy: EconomyState = { globalWealth: state.economy.globalWealth, markets: { ...state.economy.markets } }
  const market = economy.markets[commodityId]
  if (!market) return state
  economy.markets[commodityId] = { ...market }
  setMarketLevels(economy, commodityId, updates)
  return { ...state, economy }
}

export function setTension(state: SandboxState, tension: number): SandboxState {
  return { ...state, tension: Math.max(0, Math.min(1, tension)) }
}

/** Add or overwrite one freeform world fact (the GOAP WorldState shape). */
export function setWorldFact(state: SandboxState, key: string, value: string | number | boolean): SandboxState {
  if (!key.trim()) return state
  return { ...state, worldState: { ...state.worldState, [key]: value } }
}

export function removeWorldFact(state: SandboxState, key: string): SandboxState {
  const worldState = { ...state.worldState }
  delete worldState[key]
  return { ...state, worldState }
}

/** Switch between free-form tinkering (`null`), playing a sandbox-only hero, or
 * playing the world's god. Leaves any existing hero/scenes untouched, so
 * toggling back to a mode picks up where it left off. */
export function setPlayerMode(state: SandboxState, mode: PlayerMode | null): SandboxState {
  return { ...state, narrative: { ...state.narrative, playerMode: mode } }
}

/** Set whether the world's people perceive the player's hand in 'god' mode. */
export function setGodAwareness(state: SandboxState, awareness: GodAwareness): SandboxState {
  return { ...state, narrative: { ...state.narrative, godAwareness: awareness } }
}

/** Set the sandbox-only hero for 'hero' mode. A blank name is a no-op — every
 * scene turn needs a named protagonist to hand the AI. */
export function setHero(state: SandboxState, hero: Protagonist): SandboxState {
  if (!hero.name.trim()) return state
  return { ...state, narrative: { ...state.narrative, hero: { name: hero.name.trim(), description: hero.description?.trim() } } }
}

/** Append one AI-narrated turn to the scene log, capped at MAX_SCENE_LOG (oldest dropped first). */
export function appendScene(state: SandboxState, content: string, choiceText: string | null): SandboxState {
  const depth = state.narrative.scenes.length
  const scenes = [...state.narrative.scenes, { id: `scene-${depth}`, content, choiceText, depth }].slice(-MAX_SCENE_LOG)
  return { ...state, narrative: { ...state.narrative, scenes } }
}

/** Clear the scene log to restart the narrative from scratch — keeps the player mode and hero. */
export function resetNarrative(state: SandboxState): SandboxState {
  return { ...state, narrative: { ...state.narrative, scenes: [] } }
}

/** The same reader-facing "Living World" panel shape, so tinkering shows exactly what a real reader would see. */
export function sandboxPulse(state: SandboxState, mode: NarrativeMode): WorldPulse {
  return buildWorldPulse(
    { factionStatus: FactionManager.getSummary(state.factions), economySummary: EconomyManager.getSummary(state.economy) },
    { director: { tension: state.tension } },
    mode,
  )
}

/** The Director's own stakes-flavor line for the current tension dial position. */
export function sandboxStakesLine(state: SandboxState, mode: NarrativeMode): string {
  return DifficultyManager.directive(state.tension, mode)
}

export { DEFAULT_COMMODITIES }
