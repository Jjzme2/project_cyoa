import type { ContentRating } from './content'
import type { Protagonist, StoryCharacter, DirectorPersona } from './characters'
import type { CoverTheme, ReadingTheme } from './themes'
import type { EngineState } from './engine'

// ─── Moderation ─────────────────────────────────────────────────────────────
export type ModerationStatus = 'approved' | 'flagged' | 'rejected'

export interface NodeModeration {
  status: ModerationStatus
  categories?: string[]
  reason?: string
  reviewedBy?: string | null
  reviewedAt?: string | null
}

// ─── Bounties ───────────────────────────────────────────────────────────────
export type BountyStatus = 'open' | 'paid' | 'refunded'

/** A reward escrowed on an empty choice slot, paid to whoever fills it (once approved). */
export interface SlotBounty {
  reward: number
  posterId: string
  posterName: string
  promptHint?: string
  status: BountyStatus
  /** Set when a flagged contribution is awaiting approval before the reward releases. */
  pendingClaimBy?: string | null
  pendingNodeId?: string | null
  createdAt: string
}

export interface SaveSlot {
  id: string
  name: string
  currentNodeId: string
  nodeHistory: string[]
  resources?: Record<string, number | string | string[]>
  resourcesHistory?: Record<string, number | string | string[]>[]
  savedAt: string
}

export interface StoryTreeNode {
  nodeId: string
  content: string
  depth: number
  choiceText: string | null
  imageUrl: string | null
  aiGenerated: boolean
  createdAt: string
  slots: {
    id: string
    slotIndex: number
    filled: boolean
    promptText: string | null
    submitterName: string | null
    childNodeId: string | null
  }[]
  children: StoryTreeNode[]
}

export interface StoryPathSegment {
  id: string
  content: string
  choiceText: string | null
  depth: number
}

export interface Story {
  id: string
  title: string
  description: string
  worldId: string
  worldName: string
  authorId: string
  authorName: string
  rootNodeId: string | null
  published: boolean
  coverGradient: string
  views: number
  nodeCount: number
  createdAt: string
  tags?: string[]
  /** Content rating; defaults to the world's rating, admin-overridable. */
  rating?: ContentRating
  ratingOverriddenBy?: string | null
  /** Authored by the Chronicle team as starter content, not the community. */
  seeded?: boolean
  resources?: ResourceDefinition[]
  /** Author-defined hero the reader plays as; the AI writes them by name. */
  protagonist?: Protagonist
  /** "You" mode: the reader IS the protagonist (no authored protagonist), and
   * their standing persists across stories in this world. */
  youMode?: boolean
  /** When true, the story is kept personal — hidden from public listings
   * (still reachable by direct link and shown in the author's own spaces). */
  unlisted?: boolean
  /** Authored directorial sensibility that shapes how chapters are directed. */
  director?: DirectorPersona
  /** Canon cast — author-seeded and grown emergently as the AI introduces characters. */
  characters?: StoryCharacter[]
  coverTheme?: CoverTheme
  readingTheme?: ReadingTheme
  /** Whether Goal-Oriented Action Planning is enabled for characters in this story */
  goapEnabled?: boolean
  /** Whether procedural quests should be generated in this story */
  implementQuests?: boolean
  /** The initial world state for GOAP at the start of the story */
  initialWorldState?: Record<string, string | number | boolean>
  /** Market threshold rules: when a commodity becomes scarce or cheap, modify player resources. */
  economyEffects?: import('@/types/economy').EconomyResourceEffect[]
}

export interface StoryNode {
  id: string
  storyId: string
  content: string
  depth: number
  parentId: string | null
  choiceText: string | null
  slots: ChoiceSlot[]
  authorId: string | null
  aiGenerated: boolean
  aiModel: string | null
  imageUrl: string | null
  /**
   * Whether this route is publicly visible. Flagged or admin-rejected routes
   * are `false` and only surface to admins.
   */
  published: boolean
  moderation?: NodeModeration
  /** How many times readers have arrived at this route (for reads/reputation). */
  traversals?: number
  /** Serialised simulation state at this node (factions, economy, agent memories). */
  engineState?: EngineState
  /** Content Judge craft score (0-100); informational, for future ranking. */
  qualityScore?: number
  createdAt: string
}

export interface ChoiceSlot {
  id: string
  nodeId: string
  slotIndex: number
  promptText: string | null
  filled: boolean
  childNodeId: string | null
  submittedBy: string | null
  submitterName: string | null
  locked: boolean
  lockedBy: string | null
  lockedAt: string | null
  createdAt: string
  /**
   * Indicates whether the child node (destination page) of this filled slot has an illustration.
   * This is calculated dynamically on fetch or updated upon successful image generation.
   */
  childHasImage?: boolean
  /** How many times readers have taken this path (popularity / "% went here"). */
  traversals?: number
  /**
   * Set when a filled slot's child route is awaiting moderation and is hidden
   * from non-admin readers. The child id is withheld so the path can't be
   * opened, and the slot is not re-writable.
   */
  pendingReview?: boolean
  /** Moderation status of the child route (surfaced to admins for review). */
  childModeration?: ModerationStatus
  /** An open reward escrowed on this (empty) slot. */
  bounty?: SlotBounty | null
  requirements?: ChoiceRequirement[]
  effects?: ChoiceEffect[]
  /** Community flag-to-remove vote count. The flaggedBy array is Firestore-only. */
  flagVoteCount?: number
  /** GOAP world state changes applied when this choice is selected */
  stateEffects?: Record<string, string | number | boolean>
  /**
   * Memory events recorded for named characters when this choice is selected.
   * Each entry records whether the reader helped or harmed that character.
   */
  memoryEffects?: ChoiceMemoryEffect[]
}

// Re-export for convenience so consumers can import from '@/types'

export type ResourceDisplayAs = 'value' | 'bar' | 'badge' | 'checkbox'

export interface ResourceDefinition {
  name: string
  type: 'number' | 'string' | 'array' | 'boolean'
  defaultValue: number | string | string[] | boolean
  description?: string
  min?: number
  max?: number
  hidden?: boolean
  icon?: string
  displayAs?: ResourceDisplayAs
  color?: string
  isInitialChoice?: boolean
  choices?: string[]
}

export interface ChoiceMemoryEffect {
  /** Name of the character to record the memory for (must match a StoryCharacter.name) */
  characterName: string
  /** Whether this choice was kind or hostile towards the character */
  sentiment: 'positive' | 'negative' | 'neutral'
  /** Short description stored in the memory record */
  event: string
}

export interface ChoiceRequirement {
  resourceName: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains'
  value: number | string
}

export interface ChoiceEffect {
  resourceName: string
  operator: '=' | '+=' | '-=' | 'add' | 'remove'
  value: number | string
}

