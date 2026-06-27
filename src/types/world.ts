import type { ContentRating } from './content'

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

