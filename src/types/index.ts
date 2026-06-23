export const STORY_TAGS = [
  // Core genres
  'Fantasy', 'Dark Fantasy', 'Urban Fantasy', 'Fairy Tale', 'Mythology',
  'Horror', 'Gothic', 'Cosmic Horror', 'Supernatural',
  'Sci-Fi', 'Space Opera', 'Cyberpunk', 'Biopunk', 'Solarpunk',
  'Mystery', 'Noir', 'Thriller', 'Psychological',
  // Adventure & tone
  'Adventure', 'Survival', 'Action', 'Political',
  'Romance', 'Comedy', 'Slice of Life', 'Drama',
  // Setting
  'Historical', 'Alternate History', 'Post-Apocalyptic', 'Steampunk', 'Western',
  // Mechanics & style
  'LitRPG', 'Magical Realism',
] as const
export type StoryTag = typeof STORY_TAGS[number]

import { GOAPGoal, PersonalityWeights } from './goap'
import type { EngineState } from './engine'

// ─── Roles & Access Control ─────────────────────────────────────────────────
export type Role = 'user' | 'admin'

// ─── Content Ratings (worlds) ───────────────────────────────────────────────
export const CONTENT_RATINGS = ['Everyone', 'Teen', 'Mature'] as const
export type ContentRating = typeof CONTENT_RATINGS[number]

export const CONTENT_RATING_META: Record<
  ContentRating,
  { abbr: string; description: string; className: string }
> = {
  Everyone: {
    abbr: 'E',
    description: 'Suitable for all ages. No graphic content.',
    className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  },
  Teen: {
    abbr: 'T',
    description: 'Mild language, violence, or themes. Roughly 13+.',
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  },
  Mature: {
    abbr: 'M',
    description: 'Strong language, violence, or mature themes. 17+.',
    className: 'text-red-400 bg-red-500/10 border-red-500/25',
  },
}

export const DEFAULT_CONTENT_RATING: ContentRating = 'Everyone'

// ─── Moderation ─────────────────────────────────────────────────────────────
export type ModerationStatus = 'approved' | 'flagged' | 'rejected'

export interface NodeModeration {
  status: ModerationStatus
  categories?: string[]
  reason?: string
  reviewedBy?: string | null
  reviewedAt?: string | null
}

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
  /** Optional free-text directorial vision. */
  vision?: string
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

// ─── Co-op reading rooms ──────────────────────────────────────────────────────
export type RoomStatus = 'voting' | 'writing' | 'ended'

export interface RoomMember {
  name: string
  photo?: string | null
  /** ISO timestamp of the member's last heartbeat — used for presence. */
  lastSeen: string
}

/** A live "read together" session: a group votes on each choice and advances in sync. */
export interface Room {
  id: string
  storyId: string
  storyTitle: string
  hostId: string
  status: RoomStatus
  currentNodeId: string
  round: number
  /** ISO timestamp the current voting round closes. */
  roundEndsAt: string
  roundSeconds: number
  members: Record<string, RoomMember>
  /** uid → slotId the member voted for this round. */
  votes: Record<string, string>
  createdAt: string
  lastActivity: string
}

export interface Bookmark {
  id: string
  userId: string
  storyId: string
  storyTitle: string
  storyAuthorName: string
  worldName: string
  coverGradient: string
  createdAt: string
}

export type NotificationType = 'new_contribution' | 'achievement_earned'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  storyId?: string
  storyTitle?: string
  nodeId?: string
  contributorName?: string
  slotPrompt?: string
  achievementId?: string
  read: boolean
  createdAt: string
}

export interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_step',    name: 'First Step',     description: 'Contributed your first story path',  icon: '✍️' },
  { id: 'prolific',      name: 'Prolific',        description: '10 paths contributed',               icon: '📚' },
  { id: 'chronicler',   name: 'Chronicler',      description: '50 paths contributed',               icon: '📜' },
  { id: 'sage',          name: 'Sage',            description: '100 paths contributed',              icon: '🔮' },
  { id: 'illustrator',  name: 'Illustrator',     description: 'Generated your first illustrated path', icon: '🎨' },
  { id: 'world_builder', name: 'World Builder',  description: 'Created your first world',           icon: '🌍' },
  { id: 'storyteller',  name: 'Storyteller',     description: 'Created your first story',           icon: '📖' },
  { id: 'explorer',     name: 'Explorer',        description: 'Read 5 different stories',           icon: '🔭' },
  { id: 'bookworm',     name: 'Bookworm',        description: 'Read 10 different stories',          icon: '🦉' },
  { id: 'librarian',    name: 'Librarian',       description: 'Bookmarked 10 stories',             icon: '🔖' },
]

export interface UserAchievements {
  earned: string[]
  counts: {
    contributions: number
    storiesRead: number
    bookmarks: number
    worlds: number
    stories: number
    illustrations: number
  }
  updatedAt: string
}

export type ReactionType = '👏' | '✨' | '😮' | '😂'
export const REACTION_TYPES: ReactionType[] = ['👏', '✨', '😮', '😂']
export const REACTION_LABELS: Record<ReactionType, string> = {
  '👏': 'Bravo',
  '✨': 'Vivid',
  '😮': 'Surprising',
  '😂': 'Funny',
}

export interface NodeReactions {
  counts: Record<ReactionType, number>
  userReactions: ReactionType[]
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

export interface FirebaseUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  tier: 'FREE' | 'PREMIUM'
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
  /** Content rating set by the creator; admins may override it. */
  rating?: ContentRating
  /** uid of the admin who last overrode the rating, if any. */
  ratingOverriddenBy?: string | null
  /** Authored by the Chronicle team as starter content, not the community. */
  seeded?: boolean
  /** Procedural generation seed for this world. */
  seed?: number
  createdAt: string
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
export type { EngineState }

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

// ─── Cover & Reading Themes ────────────────────────────────────────────────────

export type CoverPattern = 'none' | 'stars' | 'grid' | 'dots' | 'lines' | 'diamonds' | 'waves' | 'crosshatch'
export type CoverFontStyle = 'serif' | 'gothic' | 'script' | 'mono'
export type CoverBorderFrame = 'none' | 'single' | 'double' | 'ornate' | 'runic' | 'thorn' | 'celestial' | 'vine'
export type PageStyle = 'parchment' | 'sepia' | 'night' | 'forest' | 'ocean' | 'rose'
export type AmbientEffect = 'none' | 'rain' | 'embers' | 'stars' | 'snow'

export interface CoverTheme {
  fromColor: string
  toColor: string
  icon: string
  pattern: CoverPattern
  fontStyle: CoverFontStyle
  coverImageUrl?: string
  borderFrame?: CoverBorderFrame
  accentColor?: string
}

export interface ReadingTheme {
  pageStyle: PageStyle
  ambientEffect: AmbientEffect
}

export class UserProfile {
  public readonly uid: string
  public readonly email: string | null
  public readonly displayName: string | null
  public readonly photoURL: string | null
  public readonly tier: 'FREE' | 'PREMIUM'
  public readonly stripeCustomerId: string | null
  public readonly stripeSubscriptionId: string | null
  public readonly subscriptionStatus: string | null
  public readonly subscriptionPeriodEnd: string | null
  public readonly purchasedCredits: number
  public readonly lifetimeCreditsPurchased: number
  public readonly createdAt: string
  public readonly dateOfBirth: string | null

  constructor(
    uid: string,
    email: string | null,
    displayName: string | null,
    photoURL: string | null,
    tier: 'FREE' | 'PREMIUM' = 'FREE',
    stripeCustomerId: string | null = null,
    stripeSubscriptionId: string | null = null,
    subscriptionStatus: string | null = null,
    subscriptionPeriodEnd: string | null = null,
    purchasedCredits = 0,
    lifetimeCreditsPurchased = 0,
    createdAt: string = new Date().toISOString(),
    dateOfBirth: string | null = null
  ) {
    this.uid = uid
    this.email = email
    this.displayName = displayName
    this.photoURL = photoURL
    this.tier = tier
    this.stripeCustomerId = stripeCustomerId
    this.stripeSubscriptionId = stripeSubscriptionId
    this.subscriptionStatus = subscriptionStatus
    this.subscriptionPeriodEnd = subscriptionPeriodEnd
    this.purchasedCredits = purchasedCredits
    this.lifetimeCreditsPurchased = lifetimeCreditsPurchased
    this.createdAt = createdAt
    this.dateOfBirth = dateOfBirth
  }

  public static fromFirestore(uid: string, data: any): UserProfile {
    return new UserProfile(
      uid,
      data.email ?? null,
      data.displayName ?? null,
      data.photoURL ?? null,
      (data.tier as 'FREE' | 'PREMIUM') ?? 'FREE',
      data.stripeCustomerId ?? null,
      data.stripeSubscriptionId ?? null,
      data.subscriptionStatus ?? null,
      data.subscriptionPeriodEnd ?? null,
      data.purchasedCredits ?? 0,
      data.lifetimeCreditsPurchased ?? 0,
      data.createdAt ?? new Date().toISOString(),
      data.dateOfBirth ?? null
    )
  }

  public toFirestore(): Record<string, any> {
    return {
      email: this.email,
      displayName: this.displayName,
      photoURL: this.photoURL,
      tier: this.tier,
      stripeCustomerId: this.stripeCustomerId,
      stripeSubscriptionId: this.stripeSubscriptionId,
      subscriptionStatus: this.subscriptionStatus,
      subscriptionPeriodEnd: this.subscriptionPeriodEnd,
      purchasedCredits: this.purchasedCredits,
      lifetimeCreditsPurchased: this.lifetimeCreditsPurchased,
      createdAt: this.createdAt,
      dateOfBirth: this.dateOfBirth,
      updatedAt: new Date().toISOString()
    }
  }
}
