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

