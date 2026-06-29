import type { ContentRating, CoverTheme, DirectorPersona, ReadingTheme } from '@/types'

/**
 * A one-shot payload that carries an in-progress story's authored data into the
 * saga creator, so "turn this into a saga" never drops what the user already
 * wrote. Written by the story creator (and, later, a saved-story action) and
 * consumed once by the saga creator on mount.
 *
 * Distinct from the saga's own autosaved draft (`chronicle:draft:saga`) — this
 * is a transfer, read-and-cleared immediately, not a persistent draft.
 */
export const SAGA_HANDOFF_KEY = 'chronicle:handoff:saga'

export interface SagaHandoffEntry {
  label: string
  premise: string
}

export interface SagaHandoff {
  title: string
  description: string
  worldId: string
  rating: ContentRating
  tags: string[]
  director: DirectorPersona
  styleChoices: Record<string, string>
  coverTheme: CoverTheme
  readingTheme: ReadingTheme
  shared: boolean
  /** Seeded saga-level premise (e.g. from the story's written opening). */
  premise: string
  /** Seeded doorways (e.g. derived from the protagonist the author defined). */
  entryPoints: SagaHandoffEntry[]
  /** Where the handoff originated, for the confirmation toast. */
  source: 'story-draft' | 'story'
}
