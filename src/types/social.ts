import type { EndingType } from './story'

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
  /** Purchased credits granted atomically on unlock (0/omitted = none). */
  reward?: number
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_step',    name: 'First Step',     description: 'Contributed your first story path',  icon: '✍️', reward: 3 },
  { id: 'prolific',      name: 'Prolific',        description: '10 paths contributed',               icon: '📚', reward: 5 },
  { id: 'chronicler',   name: 'Chronicler',      description: '50 paths contributed',               icon: '📜', reward: 10 },
  { id: 'sage',          name: 'Sage',            description: '100 paths contributed',              icon: '🔮', reward: 15 },
  { id: 'illustrator',  name: 'Illustrator',     description: 'Generated your first illustrated path', icon: '🎨', reward: 3 },
  { id: 'world_builder', name: 'World Builder',  description: 'Created your first world',           icon: '🌍', reward: 5 },
  { id: 'storyteller',  name: 'Storyteller',     description: 'Created your first story',           icon: '📖', reward: 5 },
  { id: 'explorer',     name: 'Explorer',        description: 'Read 5 different stories',           icon: '🔭', reward: 5 },
  { id: 'bookworm',     name: 'Bookworm',        description: 'Read 10 different stories',          icon: '🦉', reward: 5 },
  { id: 'librarian',    name: 'Librarian',       description: 'Bookmarked 10 stories',             icon: '🔖', reward: 5 },
  // Narrative-aware — earned in-fiction, each a shareable card.
  { id: 'the_end',      name: 'The End',         description: 'Reached your first true ending',     icon: '🏁', reward: 10 },
  { id: 'secret_keeper', name: 'Secret Keeper',  description: 'Discovered a secret ending',         icon: '🗝️', reward: 15 },
  { id: 'every_ending', name: 'All Roads',       description: 'Collected all five kinds of ending', icon: '🎭', reward: 20 },
  // v2 additions.
  { id: 'wanderer',      name: 'Wanderer',        description: 'Began your first personal saga',     icon: '🧭', reward: 5 },
  { id: 'voice_heard',  name: 'Voice Heard',     description: 'Submitted your first piece of feedback', icon: '📣', reward: 3 },
  { id: 'patron',        name: 'Patron',          description: 'Posted your first bounty',           icon: '💰', reward: 5 },
  { id: 'mercenary',     name: 'Mercenary',       description: 'Filled someone else’s bounty',   icon: '⚔️', reward: 10 },
  { id: 'renowned',      name: 'Renowned',        description: 'Earned deep standing in a world',    icon: '👑', reward: 10 },
  { id: 'kindred_spirit', name: 'Kindred Spirit', description: 'A character’s regard for you deepened to full trust', icon: '💞', reward: 10 },
  { id: 'path_pioneer',  name: 'Path Pioneer',    description: 'A path you wrote was chosen by 25 readers', icon: '🌟', reward: 15 },
  { id: 'first_choice',  name: 'First Choice',    description: 'Made your first choice in a story',   icon: '🎲', reward: 3 },
  { id: 'completionist', name: 'Completionist',   description: 'Earned every other achievement',     icon: '💎', reward: 25 },
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
    /** Definitive endings reached (distinct — see endingKeys). */
    endingsReached?: number
    /** Distinct ending types collected (for the "all kinds" achievement). */
    endingTypes?: EndingType[]
    /** storyId:nodeId keys already counted, so re-reaching an ending is
     * idempotent (capped). */
    endingKeys?: string[]
    /** Distinct story ids already counted toward storiesRead, so re-saving
     * progress within the same story never inflates the count (capped). */
    storiesReadIds?: string[]
    /** Personal sagas begun. */
    sagasCreated?: number
    /** Community feedback items submitted. */
    feedbackSubmitted?: number
    /** Bounties posted (as the poster). */
    bountiesPosted?: number
    /** Others' bounties filled (as the contributor). */
    bountiesFilled?: number
    /** Best (highest) "You" mode world standing ever reached (-1..1). */
    bestWorldStanding?: number
    /** Times a character's regard for the reader reached deep trust (>= 0.8). */
    deepBonds?: number
    /** Times one of the reader's written paths crossed the popularity threshold. */
    pathMilestones?: number
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

