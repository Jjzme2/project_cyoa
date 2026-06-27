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

