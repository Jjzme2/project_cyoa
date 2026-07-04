// ─── Co-op reading rooms ──────────────────────────────────────────────────────
/**
 * 'reading' is a gate on the chapter that just loaded: everyone marks it read
 * (or a short timer ends) before the room moves on to `pendingStatus` — voting
 * on what happens next, writing a fresh path, or the story's end.
 */
export type RoomStatus = 'reading' | 'voting' | 'writing' | 'ended'

export interface RoomMember {
  name: string
  photo?: string | null
  /** ISO timestamp of the member's last heartbeat — used for presence. */
  lastSeen: string
  /** Joined via Firebase Anonymous Auth — read-only, no writing, no AI. */
  guest?: boolean
}

/** A live "read together" session: a group votes on each choice and advances in sync. */
export interface Room {
  id: string
  storyId: string
  storyTitle: string
  hostId: string
  status: RoomStatus
  /** Only meaningful while `status === 'reading'` — what to become once the gate resolves. */
  pendingStatus?: RoomStatus
  /**
   * Only meaningful while `status === 'ended'` — distinguishes a genuine story
   * conclusion ('story') from every member having left ('empty'), so a later
   * rejoin can revive an 'empty' room instead of showing a false ending.
   */
  endedReason?: 'story' | 'empty'
  currentNodeId: string
  round: number
  /** ISO timestamp the current phase (reading gate or voting round) closes. */
  roundEndsAt: string
  roundSeconds: number
  members: Record<string, RoomMember>
  /** uid → slotId the member voted for this round. */
  votes: Record<string, string>
  /** uid → true once they've acknowledged reading the current chapter. */
  ready: Record<string, boolean>
  createdAt: string
  lastActivity: string
}

