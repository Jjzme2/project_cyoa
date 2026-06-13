export const STORY_TAGS = [
  'Fantasy', 'Horror', 'Sci-Fi', 'Mystery', 'Romance', 'Adventure',
  'Comedy', 'Thriller', 'Historical', 'Cosmic Horror', 'Fairy Tale',
  'Noir', 'Post-Apocalyptic', 'Steampunk', 'Western',
] as const
export type StoryTag = typeof STORY_TAGS[number]

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
}

export interface Protagonist {
  name: string
  description?: string
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
export type RoomStatus = 'voting' | 'ended'

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
  /** Canon cast — author-seeded and grown emergently as the AI introduces characters. */
  characters?: StoryCharacter[]
  coverTheme?: CoverTheme
  readingTheme?: ReadingTheme
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
}

export interface ResourceDefinition {
  name: string
  type: 'number' | 'string' | 'array'
  defaultValue: number | string | string[]
  description?: string
  min?: number
  max?: number
  hidden?: boolean
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

export type CoverPattern = 'none' | 'stars' | 'grid' | 'dots' | 'lines'
export type CoverFontStyle = 'serif' | 'gothic' | 'script'
export type PageStyle = 'parchment' | 'sepia' | 'night' | 'forest' | 'ocean' | 'rose'
export type AmbientEffect = 'none' | 'rain' | 'embers' | 'stars' | 'snow'

export interface CoverTheme {
  fromColor: string
  toColor: string
  icon: string
  pattern: CoverPattern
  fontStyle: CoverFontStyle
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
