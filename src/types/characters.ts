import type { GOAPGoal, PersonalityWeights } from './goap'

// ─── Characters ─────────────────────────────────────────────────────────────
/** A canon character in a story. Author may define some; more emerge as the AI introduces them. */
export interface StoryCharacter {
  name: string
  description?: string
  /** e.g. 'alive', 'deceased', 'missing' — the AI must respect this for continuity. */
  status?: string
  /** GOAP configuration for this character, if living characters are enabled */
  goapConfig?: {
    goals: GOAPGoal[]
    availableActions: string[]
    personality: PersonalityWeights
  }
}

export interface Protagonist {
  name: string
  description?: string
}

/** A reader's persistent standing within a world (across stories), for "You" mode. */
export interface WorldReputation {
  userId: string
  worldId: string
  /** The reader's display name, for the Legends board. */
  name?: string
  /** -1 reviled .. +1 revered — how the world's denizens regard this reader. */
  standing: number
  /** Recent standing samples, for trend display (capped). */
  history?: { standing: number; at: string }[]
  updatedAt: string
}

/** A notable deed recorded in a world's shared chronicle (from personal sagas). */
export interface ChronicleEntry {
  /** A one-line, in-world account of the deed. */
  text: string
  /** The reader (protagonist) who did it. */
  byName: string
  /** -1 villainous .. +1 heroic. */
  conduct: number
  storyId: string
  at: string
}

/**
 * An authored "director" sensibility that shapes HOW the AI directs each chapter
 * (its craft and mood, within the content rating). Each axis is -1..1.
 */
export interface DirectorPersona {
  /** -1 traditional .. +1 experimental */
  experimental: number
  /** -1 sensitive/gentle .. +1 assertive/intense */
  intensity: number
  /** -1 warm/romantic .. +1 dark/scary */
  darkness: number
  /** -1 slow-burn .. +1 propulsive */
  pace: number
  /** -1 solemn/earnest .. +1 playful/witty */
  levity?: number
  /** -1 spare/plain .. +1 lyrical/ornate */
  prose?: number
  /** -1 intimate/character .. +1 epic/sweeping */
  focus?: number
  /** Optional free-text directorial vision. */
  vision?: string
}

