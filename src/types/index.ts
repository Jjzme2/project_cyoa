export class StoryPathSegment {
  public readonly id: string
  public readonly content: string
  public readonly choiceText: string | null
  public readonly depth: number

  constructor(id: string, content: string, choiceText: string | null, depth: number) {
    this.id = id
    this.content = content
    this.choiceText = choiceText
    this.depth = depth
  }
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
  resources?: ResourceDefinition[]
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
  type: 'number' | 'string'
  defaultValue: number | string
}

export interface ChoiceRequirement {
  resourceName: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  value: number | string
}

export interface ChoiceEffect {
  resourceName: string
  operator: '=' | '+=' | '-='
  value: number | string
}
