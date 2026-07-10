import { FactionManager } from './engine/faction-manager'
import { EconomyManager, createDefaultEconomy, setMarketLevels, DEFAULT_COMMODITIES } from './engine/economy-manager'
import { DifficultyManager } from './engine/difficulty'
import { buildWorldPulse } from './engine/world-pulse'
import type { NarrativeMode } from './engine/narrative-mode'
import type { Faction } from '@/types/faction'
import type { EconomyState } from '@/types/economy'
import type { WorldState } from '@/types/goap'
import type { GenesisFaction, WorldPulse, Protagonist, StoryPathSegment, DirectorPersona } from '@/types'
import { emptyDirector, type DirectorAxisKey } from './director'

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

/** Faith — the god-mode play resource. Starts partial so the first acts are
 * affordable but choices bite immediately; regenerates as time ticks (see
 * advanceTicksWithEvents), faster for a KNOWN god whose people worship them. */
export const START_FAITH = 6
export const MAX_FAITH = 12
export const FAITH_REGEN_HIDDEN = 1
export const FAITH_REGEN_KNOWN = 2

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
 * A snapshot of everything a turn could have changed, taken right after that
 * turn's tick+narration committed — index-aligned with `scenes`, so rewinding
 * to scene N restores the world exactly as it was, not just the scene text.
 */
export interface NarrativeSnapshot {
  factions: Record<string, Faction>
  economy: EconomyState
  tension: number
  faith: number
}

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
  /** Only used in 'god' mode — a directorial tone override for AI turns; unset means "no override". */
  directorPersona?: DirectorPersona
  /** The ambition being played toward (see sandbox-powers.ts AMBITIONS); unset means free play. */
  ambitionId?: string
  /** Accumulated AI-narrated turns, oldest first, capped at MAX_SCENE_LOG. */
  scenes: StoryPathSegment[]
  /** One entry per scene, same order/length — see NarrativeSnapshot. */
  snapshots: NarrativeSnapshot[]
}

export interface SandboxState {
  factions: Record<string, Faction>
  economy: EconomyState
  /** Freeform world facts (the same GOAP WorldState shape) — a generic,
   * world-agnostic control surface for whatever the author imagines. */
  worldState: WorldState
  /** 0..1, directly user-controlled (not derived) — this is a toy, not a sim of the Director. */
  tension: number
  /** God-mode play resource, 0..MAX_FAITH — spent on divine acts, regained as time ticks. */
  faith: number
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
    faith: START_FAITH,
    eventLog: [],
    narrative: { playerMode: null, godAwareness: 'hidden', scenes: [], snapshots: [] },
  }
}

/**
 * Backfill fields a saved (localStorage) sandbox from an older version may
 * lack, so shipping a new field never strands returning players on a broken
 * save. If the per-scene snapshots ever disagree with the scene log (older
 * saves predate them), rebuild them from the current world so rewind stays
 * safe — it just lands on today's state instead of that turn's.
 */
export function withSavedDefaults(saved: SandboxState): SandboxState {
  const faith = typeof saved.faith === 'number' ? Math.max(0, Math.min(MAX_FAITH, saved.faith)) : START_FAITH
  const narrative: NarrativeState = {
    playerMode: saved.narrative?.playerMode ?? null,
    hero: saved.narrative?.hero,
    godAwareness: saved.narrative?.godAwareness ?? 'hidden',
    directorPersona: saved.narrative?.directorPersona,
    ambitionId: saved.narrative?.ambitionId,
    scenes: saved.narrative?.scenes ?? [],
    snapshots: saved.narrative?.snapshots ?? [],
  }
  if (narrative.snapshots.length !== narrative.scenes.length) {
    narrative.snapshots = narrative.scenes.map(() => ({
      factions: saved.factions,
      economy: saved.economy,
      tension: saved.tension,
      faith,
    }))
  } else {
    narrative.snapshots = narrative.snapshots.map((s) => ({
      ...s,
      faith: typeof s.faith === 'number' ? s.faith : faith,
    }))
  }
  return { ...saved, faith, narrative }
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
  // Faith returns with the passage of time — faster for a KNOWN god, whose
  // people actively worship, than for a hidden hand no one prays to. This is
  // what makes the awareness toggle a mechanical tradeoff, not just narration
  // flavor. Regenerating outside god mode too is harmless (faith is only
  // spendable there) and keeps this function ignorant of UI modes.
  const regen = state.narrative.godAwareness === 'known' ? FAITH_REGEN_KNOWN : FAITH_REGEN_HIDDEN
  const faith = Math.min(MAX_FAITH, state.faith + Math.max(0, ticks) * regen)
  return { state: { ...state, factions, economy, eventLog, faith }, newEvents }
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

/**
 * Append one AI-narrated turn to the scene log, capped at MAX_SCENE_LOG
 * (oldest dropped first) — and snapshot the world (factions/economy/tension)
 * exactly as `state` has them right now, so a later `rewindTo` this scene
 * restores the world, not just the text. Call this with the ALREADY-ticked
 * state (see WorldSandbox.tsx's narrate()), so the snapshot reflects what
 * this turn actually did.
 */
export function appendScene(state: SandboxState, content: string, choiceText: string | null): SandboxState {
  const depth = state.narrative.scenes.length
  const scenes = [...state.narrative.scenes, { id: `scene-${depth}`, content, choiceText, depth }].slice(-MAX_SCENE_LOG)
  const snapshot: NarrativeSnapshot = { factions: state.factions, economy: state.economy, tension: state.tension, faith: state.faith }
  const snapshots = [...state.narrative.snapshots, snapshot].slice(-MAX_SCENE_LOG)
  return { ...state, narrative: { ...state.narrative, scenes, snapshots } }
}

/** Clear the scene log to restart the narrative from scratch — keeps the player mode and hero. */
export function resetNarrative(state: SandboxState): SandboxState {
  return { ...state, narrative: { ...state.narrative, scenes: [], snapshots: [] } }
}

/**
 * Rewind to right after `sceneId` — both the scene log (dropping everything
 * after it) AND the world itself (factions/economy/tension restored to that
 * turn's snapshot). A no-op if the scene isn't found. This is what makes
 * "rewind" a genuine branch point: playing on from here explores a different
 * path with the SAME world state that turn actually left behind, not a
 * continuation still carrying later turns' consequences.
 */
export function rewindTo(state: SandboxState, sceneId: string): SandboxState {
  const idx = state.narrative.scenes.findIndex((s) => s.id === sceneId)
  const snapshot = idx === -1 ? undefined : state.narrative.snapshots[idx]
  if (!snapshot) return state
  return {
    ...state,
    factions: snapshot.factions,
    economy: snapshot.economy,
    tension: snapshot.tension,
    faith: snapshot.faith,
    narrative: {
      ...state.narrative,
      scenes: state.narrative.scenes.slice(0, idx + 1),
      snapshots: state.narrative.snapshots.slice(0, idx + 1),
    },
  }
}

/** Pick (or clear, with undefined) the ambition being played toward. */
export function setAmbition(state: SandboxState, ambitionId: string | undefined): SandboxState {
  return { ...state, narrative: { ...state.narrative, ambitionId } }
}

/** Set (or clear, passing a value back to 0) one axis of the god-mode directorial tone override. */
export function setDirectorAxis(state: SandboxState, key: DirectorAxisKey, value: number): SandboxState {
  const base = state.narrative.directorPersona ?? emptyDirector()
  const clamped = Math.max(-1, Math.min(1, value))
  return { ...state, narrative: { ...state.narrative, directorPersona: { ...base, [key]: clamped } } }
}

/** Set the god-mode directorial free-text vision note. */
export function setDirectorVision(state: SandboxState, vision: string): SandboxState {
  const base = state.narrative.directorPersona ?? emptyDirector()
  return { ...state, narrative: { ...state.narrative, directorPersona: { ...base, vision: vision.slice(0, 300) } } }
}

/** Replace the whole god-mode directorial persona at once — e.g. an archetype preset. */
export function setDirectorPersona(state: SandboxState, persona: DirectorPersona): SandboxState {
  return { ...state, narrative: { ...state.narrative, directorPersona: persona } }
}

/** Clear the god-mode directorial override entirely (back to "no override"). */
export function clearDirectorPersona(state: SandboxState): SandboxState {
  return { ...state, narrative: { ...state.narrative, directorPersona: undefined } }
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

/**
 * Render the played-out scene log as a shareable plain-text transcript — the
 * "save & share a run" surface. Deliberately a local export, not a hosted
 * link: nothing about this sandbox is persisted server-side, so a shareable
 * URL would mean introducing new storage for a feature that's supposed to
 * stay a consequence-free toy. Returns '' if there's nothing played yet.
 */
export function renderTranscript(state: SandboxState, worldName: string): string {
  const { playerMode, hero, scenes } = state.narrative
  if (scenes.length === 0) return ''
  const who = playerMode === 'hero' && hero ? `played as ${hero.name}` : "played as the world's unseen god"
  const header = `${worldName} — Sandbox (${who})`
  const body = scenes
    .map((s) => (s.choiceText ? `→ ${s.choiceText}\n\n${s.content}` : s.content))
    .join('\n\n' + '─'.repeat(20) + '\n\n')
  return `${header}\n${'═'.repeat(header.length)}\n\n${body}\n`
}

export { DEFAULT_COMMODITIES }
