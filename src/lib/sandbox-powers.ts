import {
  nudgeFactionStat,
  setFactionSentiment,
  setMarket,
  setTension,
  MAX_EVENT_LOG,
  type SandboxState,
} from './world-sandbox'
import { DEFAULT_COMMODITIES } from './engine/economy-manager'

/**
 * The playable layer of World Sandbox (v5): concrete ACTS instead of raw
 * dials. A god spends faith on divine powers; a hero does small free deeds.
 * Every act resolves through the same pure world-sandbox helpers the dials
 * use — this module adds verbs, costs, and flavor, never new simulation
 * rules. Ambitions give the play a direction: live goals evaluated against
 * the sim state, no persistence, no reward beyond the world itself.
 */

/** What an act needs aimed at it. 'pair' takes two faction ids, in order. */
export type ActTarget = 'faction' | 'pair' | 'market' | 'none'

export interface SandboxAct {
  id: string
  name: string
  emoji: string
  /** One-line description shown under/next to the act. */
  description: string
  /** Faith cost — always 0 for hero deeds. */
  cost: number
  /** False = genuinely removed in gentle worlds, same bar as engine raids. */
  gentleSafe: boolean
  target: ActTarget
  apply(state: SandboxState, targets: string[]): SandboxState
  /** Event-log/AI-briefing line for the act, written as world narration. */
  flavor(state: SandboxState, targets: string[]): string
}

function factionName(state: SandboxState, id: string | undefined): string {
  return (id && state.factions[id]?.name) || 'a power'
}

function marketName(id: string | undefined): string {
  return DEFAULT_COMMODITIES.find((c) => c.id === id)?.name.toLowerCase() ?? 'goods'
}

/** Move a market's supply or demand by a delta (helpers take absolutes). */
function nudgeMarket(state: SandboxState, id: string | undefined, key: 'supply' | 'demand', delta: number): SandboxState {
  const market = id ? state.economy.markets[id] : undefined
  if (!market || !id) return state
  return setMarket(state, id, { [key]: market[key] + delta })
}

/** Move both directions of a faction pair's sentiment by a delta. */
function nudgePairSentiment(state: SandboxState, [a, b]: string[], delta: number): SandboxState {
  const fa = a ? state.factions[a] : undefined
  const fb = b ? state.factions[b] : undefined
  if (!fa || !fb || a === b) return state
  const aToB = fa.relationships.find((r) => r.factionId === b)?.sentiment ?? 0
  const bToA = fb.relationships.find((r) => r.factionId === a)?.sentiment ?? 0
  return setFactionSentiment(setFactionSentiment(state, a, b, aToB + delta), b, a, bToA + delta)
}

export const DIVINE_POWERS: SandboxAct[] = [
  {
    id: 'blessing_of_plenty',
    name: 'Blessing of Plenty',
    emoji: '🌾',
    description: 'Swell the supply of one good across the land.',
    cost: 2,
    gentleSafe: true,
    target: 'market',
    apply: (state, [id]) => nudgeMarket(state, id, 'supply', 25),
    flavor: (state, [id]) => `An unseasonable bounty of ${marketName(id)} spreads through every market.`,
  },
  {
    id: 'creeping_blight',
    name: 'Creeping Blight',
    emoji: '🥀',
    description: 'Wither the supply of one good.',
    cost: 3,
    gentleSafe: false,
    target: 'market',
    apply: (state, [id]) => nudgeMarket(state, id, 'supply', -25),
    flavor: (state, [id]) => `A creeping blight thins the ${marketName(id)}; stores run low and prices whisper upward.`,
  },
  {
    id: 'golden_favor',
    name: 'Golden Favor',
    emoji: '💰',
    description: "Swell one faction's coffers.",
    cost: 2,
    gentleSafe: true,
    target: 'faction',
    apply: (state, [id]) => (id ? nudgeFactionStat(state, id, 'wealth', 25) : state),
    flavor: (state, [id]) => `Fortune finds ${factionName(state, id)} — ventures succeed, debts resolve, coffers swell.`,
  },
  {
    id: 'voice_of_renown',
    name: 'Voice of Renown',
    emoji: '📯',
    description: "Lift one faction's standing in every hall.",
    cost: 2,
    gentleSafe: true,
    target: 'faction',
    apply: (state, [id]) => (id ? nudgeFactionStat(state, id, 'influence', 20) : state),
    flavor: (state, [id]) => `Songs and rumors carry the name of ${factionName(state, id)} further than ever before.`,
  },
  {
    id: 'whispered_doubt',
    name: 'Whispered Doubt',
    emoji: '🌫️',
    description: "Erode one faction's influence.",
    cost: 3,
    gentleSafe: false,
    target: 'faction',
    apply: (state, [id]) => (id ? nudgeFactionStat(state, id, 'influence', -20) : state),
    flavor: (state, [id]) => `Doubt seeps through the halls of ${factionName(state, id)}; old allies grow quiet.`,
  },
  {
    id: 'bond_of_kinship',
    name: 'Bond of Kinship',
    emoji: '🤝',
    description: 'Warm two factions toward each other.',
    cost: 2,
    gentleSafe: true,
    target: 'pair',
    apply: (state, targets) => nudgePairSentiment(state, targets, 35),
    flavor: (state, [a, b]) =>
      `An unexpected kindness passes between ${factionName(state, a)} and ${factionName(state, b)}; old wariness softens.`,
  },
  {
    id: 'seeds_of_discord',
    name: 'Seeds of Discord',
    emoji: '🐍',
    description: 'Turn two factions against each other.',
    cost: 4,
    gentleSafe: false,
    target: 'pair',
    apply: (state, targets) => nudgePairSentiment(state, targets, -35),
    flavor: (state, [a, b]) =>
      `A slight — real or imagined — festers between ${factionName(state, a)} and ${factionName(state, b)}.`,
  },
  {
    id: 'still_waters',
    name: 'Still Waters',
    emoji: '🕊️',
    description: 'Ease the tension hanging over the world.',
    cost: 1,
    gentleSafe: true,
    target: 'none',
    apply: (state) => setTension(state, state.tension - 0.2),
    flavor: () => 'A stillness settles over the land, and held breaths are finally let out.',
  },
  {
    id: 'gathering_storm',
    name: 'Gathering Storm',
    emoji: '⛈️',
    description: 'Thicken the air with foreboding.',
    cost: 2,
    gentleSafe: false,
    target: 'none',
    apply: (state) => setTension(state, state.tension + 0.2),
    flavor: () => 'The air thickens; dogs will not settle, and old omens are traded in low voices.',
  },
]

/** Small, free, human-scale acts for hero mode — one pair of hands, not a god's. */
export const HERO_DEEDS: SandboxAct[] = [
  {
    id: 'pitch_in',
    name: 'Pitch In',
    emoji: '💪',
    description: 'Lend your hands where one good runs short.',
    cost: 0,
    gentleSafe: true,
    target: 'market',
    apply: (state, [id]) => nudgeMarket(state, id, 'supply', 8),
    flavor: (state, [id]) => `A stranger's help moves more ${marketName(id)} than anyone expected.`,
  },
  {
    id: 'speak_up',
    name: 'Speak Up',
    emoji: '🗣️',
    description: 'Put in a good word for one faction.',
    cost: 0,
    gentleSafe: true,
    target: 'faction',
    apply: (state, [id]) => (id ? nudgeFactionStat(state, id, 'influence', 6) : state),
    flavor: (state, [id]) => `A well-placed word in the right ear does ${factionName(state, id)} a quiet favor.`,
  },
  {
    id: 'mend_fences',
    name: 'Mend Fences',
    emoji: '🧵',
    description: 'Carry an olive branch between two factions.',
    cost: 0,
    gentleSafe: true,
    target: 'pair',
    apply: (state, targets) => nudgePairSentiment(state, targets, 12),
    flavor: (state, [a, b]) =>
      `A message carried in good faith takes a little of the chill out of ${factionName(state, a)} and ${factionName(state, b)}.`,
  },
]

/** The acts a world actually offers: gentle worlds genuinely lose hostile
 * powers (same mechanical bar as the engine's raid exclusion), never just
 * their narration. */
export function availableActs(acts: SandboxAct[], gentle: boolean): SandboxAct[] {
  return gentle ? acts.filter((a) => a.gentleSafe) : acts
}

/**
 * Resolve one act: checks faith, applies the effect, spends the cost, and
 * writes the flavor line into the event log. Returns null (state untouched)
 * when faith is short or the target is invalid — the UI treats null as
 * "nothing happened", never a partial spend.
 */
export function invokeAct(
  state: SandboxState,
  act: SandboxAct,
  targets: string[] = [],
): { state: SandboxState; line: string } | null {
  if (state.faith < act.cost) return null
  const applied = act.apply(state, targets)
  if (applied === state && act.target !== 'none') return null // bad/missing target — helpers no-op by reference
  const line = act.flavor(state, targets)
  return {
    state: { ...applied, faith: applied.faith - act.cost, eventLog: [...applied.eventLog, line].slice(-MAX_EVENT_LOG) },
    line,
  }
}

// ─── Ambitions ───────────────────────────────────────────────────────────────

export interface Ambition {
  id: string
  name: string
  emoji: string
  /** What "done" looks like, in plain words. */
  description: string
  /** 0..1 — 1 means achieved. Pure read of the sim state. */
  progress(state: SandboxState): number
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export const AMBITIONS: Ambition[] = [
  {
    id: 'dominion',
    name: 'Dominion',
    emoji: '👑',
    description: 'Raise one faction above all others (influence 90+).',
    progress: (state) => clamp01(Math.max(0, ...Object.values(state.factions).map((f) => f.influence)) / 90),
  },
  {
    id: 'age_of_harmony',
    name: 'Age of Harmony',
    emoji: '🌸',
    description: 'Bring every faction to genuine warmth (all sentiments 40+).',
    progress: (state) => {
      const sentiments = Object.values(state.factions).flatMap((f) => f.relationships.map((r) => r.sentiment))
      if (sentiments.length === 0) return 0
      // Achieved when the WORST relationship reaches +40 (from a floor of -100).
      return clamp01((Math.min(...sentiments) + 100) / 140)
    },
  },
  {
    id: 'golden_age',
    name: 'Golden Age',
    emoji: '✨',
    description: 'Make every faction prosperous (all wealth 80+).',
    progress: (state) => {
      const wealths = Object.values(state.factions).map((f) => f.wealth)
      return wealths.length ? clamp01(Math.min(...wealths) / 80) : 0
    },
  },
  {
    id: 'world_of_plenty',
    name: 'World of Plenty',
    emoji: '🌾',
    description: 'Fill every market (all supplies 70+).',
    progress: (state) => {
      const supplies = Object.values(state.economy.markets).map((m) => m.supply)
      return supplies.length ? clamp01(Math.min(...supplies) / 70) : 0
    },
  },
]
