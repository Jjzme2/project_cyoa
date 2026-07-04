/**
 * First-class Character registry types.
 *
 * Distinct from `StoryCharacter` in `./characters`, which is a story-scoped
 * sub-object (the canon cast inside one story). A `Character` here is a
 * promoted, standalone, collectible identity that aggregates appearances across
 * stories and worlds — the seed of Chronicle's character IP.
 */

/** What disambiguates same-named characters: who "owns" the identity. */
export type CharacterScope = 'author' | 'world'

export interface CharacterAppearance {
  storyId: string
  storyTitle: string
  worldId: string
  worldName: string
  at: string
}

export interface Character {
  id: string
  name: string
  /** Identity scope — an author's hero, or a world's canon figure. */
  scope: CharacterScope
  /** authorId (scope 'author') or worldId (scope 'world'). */
  ownerId: string
  /** One-line identity / epithet. */
  tagline?: string
  description?: string
  /** Generated portrait, when one exists (gradient monogram fallback otherwise). */
  portraitUrl?: string
  /** Distinct worlds this character has appeared in (denormalized). */
  worldIds: string[]
  /** Count of distinct stories appeared in (denormalized). */
  storyCount: number
  /** Recent appearances, capped to keep the doc bounded. */
  appearances: CharacterAppearance[]
  /** Community "best character" votes — surfaces favorites in the directory. */
  voteCount?: number
  /** Voter uids, capped (like `endingKeys`) — stops deduping past the cap rather
   * than growing unboundedly; harmless at that point for a popularity signal. */
  voterIds?: string[]
  firstSeenAt: string
  updatedAt: string
}
