import type { ContentRating } from './content'
import type { WorldTheme } from './themes'

/**
 * A configurable stylistic parameter the world defines (e.g. "Rhyme scheme")
 * and the choices it offers (e.g. ABAB / ABBA / AABB / Free verse). Each story
 * in the world picks one choice per option at creation time.
 */
export interface WorldStyleOption {
  /** What's being configured, e.g. "Rhyme scheme". */
  label: string
  /** The choices a story may select from. */
  choices: string[]
}

/**
 * Authored, world-level storytelling rules that shape HOW every chapter in the
 * world is written (distinct from the per-story Director). Optional throughout.
 */
export interface WorldStorySettings {
  /** A mandate honored in every chapter (e.g. "Every chapter must contain at least one line of poetic prose"). */
  mandate?: string
  /** A pool of prose styles; the engine selects one per chapter for variety. */
  proseStyles?: string[]
  /** Recurring motifs/imagery the world returns to, woven in where they fit. */
  motifs?: string[]
  /** Configurable parameters each story chooses from at creation (see WorldStyleOption). */
  styleOptions?: WorldStyleOption[]
}

export interface World {
  id: string
  name: string
  description: string
  lore: string
  rules: string
  tone: string
  authorId: string
  authorName: string
  tags?: string[]
  /** The world's visual identity (gradient, emblem, atmosphere) shown on cards & detail pages. */
  theme?: WorldTheme
  /** Content rating set by the creator; admins may override it. */
  rating?: ContentRating
  /** uid of the admin who last overrode the rating, if any. */
  ratingOverriddenBy?: string | null
  /** Authored by the Chronicle team as starter content, not the community. */
  seeded?: boolean
  /** Procedural generation seed for this world. */
  seed?: number
  /** Procedurally generated, cross-referenced canon (regions, factions, characters, history). */
  genesis?: WorldBible
  /** World-level storytelling rules (prose mandate, style pool, motifs). */
  storySettings?: WorldStorySettings
  createdAt: string
}

// ─── Procedural world genesis ─────────────────────────────────────────────────
export interface GenesisRegion {
  name: string
  biome: string
  description: string
}
export interface GenesisFaction {
  name: string
  archetype: string
  /** Region this faction holds. */
  seat: string
  founding: string
  /** Names of a rival / ally faction, for a logical web. */
  rivalOf: string | null
  allyOf: string | null
}
export interface GenesisCharacter {
  name: string
  role: string
  /** Faction this character belongs to (by name), if any. */
  faction: string | null
  bio: string
  /** A sentence tying them to another character or faction (grudge / bond). */
  tie: string | null
}
export interface GenesisEvent {
  era: string
  title: string
  account: string
}
/** A world's generated canon — the "world bible" its stories draw on. */
export interface WorldBible {
  regions: GenesisRegion[]
  factions: GenesisFaction[]
  characters: GenesisCharacter[]
  history: GenesisEvent[]
  generatedAt: string
}

