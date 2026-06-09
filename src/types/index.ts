export const STORY_TAGS = [
  'Fantasy', 'Horror', 'Sci-Fi', 'Mystery', 'Romance', 'Adventure',
  'Comedy', 'Thriller', 'Historical', 'Cosmic Horror', 'Fairy Tale',
  'Noir', 'Post-Apocalyptic', 'Steampunk', 'Western',
] as const
export type StoryTag = typeof STORY_TAGS[number]

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
  resources?: ResourceDefinition[]
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
    createdAt: string = new Date().toISOString()
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
      data.createdAt ?? new Date().toISOString()
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
      updatedAt: new Date().toISOString()
    }
  }
}
