import { adminDb } from './firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getStory, getStoryNode } from './firestore-helpers'
import type { Room, RoomMember, ChoiceSlot } from '@/types'

/**
 * Co-op reading rooms.
 *
 * All mutations run server-side through the Admin SDK; clients only ever read
 * the room doc (via onSnapshot) per the `rooms` security rules. Round
 * resolution is idempotent — guarded by the round number — so any client whose
 * countdown expires can safely trigger it and only the first call advances.
 */

export const ROUND_SECONDS = 30
export const MAX_MEMBERS = 20

function roomRef(roomId: string) {
  return adminDb.collection('rooms').doc(roomId)
}

interface Actor {
  uid: string
  name: string | null
  photo?: string | null
}

/** Filled paths a room can navigate to from a node. */
function navigableSlots(slots: ChoiceSlot[] | undefined): ChoiceSlot[] {
  return (slots ?? []).filter((s) => s.filled && s.childNodeId)
}

function member(actor: Actor): RoomMember {
  return { name: actor.name ?? 'Anonymous', photo: actor.photo ?? null, lastSeen: new Date().toISOString() }
}

export async function createRoom(
  storyId: string,
  host: Actor,
): Promise<{ roomId?: string; error?: string }> {
  const story = await getStory(storyId)
  if (!story) return { error: 'Story not found.' }
  if (!story.rootNodeId) return { error: 'This story has no opening chapter yet.' }

  const rootNode = await getStoryNode(storyId, story.rootNodeId)
  const now = new Date()
  // A story with no branches yet can't be co-read — start it already ended.
  const status = navigableSlots(rootNode?.slots).length > 0 ? 'voting' : 'ended'

  const room: Omit<Room, 'id'> = {
    storyId,
    storyTitle: story.title,
    hostId: host.uid,
    status,
    currentNodeId: story.rootNodeId,
    round: 1,
    roundEndsAt: new Date(now.getTime() + ROUND_SECONDS * 1000).toISOString(),
    roundSeconds: ROUND_SECONDS,
    members: { [host.uid]: member(host) },
    votes: {},
    createdAt: now.toISOString(),
    lastActivity: now.toISOString(),
  }
  const ref = await adminDb.collection('rooms').add(room)
  return { roomId: ref.id }
}

export async function joinRoom(roomId: string, actor: Actor): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  let error: string | undefined
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) {
      error = 'Room not found.'
      return
    }
    const data = doc.data() as Room
    const now = new Date().toISOString()
    if (data.members[actor.uid]) {
      // Already a member — just refresh presence.
      txn.update(ref, { [`members.${actor.uid}.lastSeen`]: now, lastActivity: now })
      return
    }
    if (Object.keys(data.members).length >= MAX_MEMBERS) {
      error = 'This room is full.'
      return
    }
    txn.update(ref, { [`members.${actor.uid}`]: member(actor), lastActivity: now })
  })
  return { error }
}

export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  const ref = roomRef(roomId)
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) return
    const data = doc.data() as Room
    if (!data.members[uid]) return

    const remaining = Object.keys(data.members).filter((id) => id !== uid)
    const update: Record<string, unknown> = {
      [`members.${uid}`]: FieldValue.delete(),
      [`votes.${uid}`]: FieldValue.delete(),
      lastActivity: new Date().toISOString(),
    }
    if (remaining.length === 0) {
      update.status = 'ended'
    } else if (data.hostId === uid) {
      update.hostId = remaining[0] // promote the next member
    }
    txn.update(ref, update)
  })
}

export async function castVote(
  roomId: string,
  uid: string,
  slotId: string,
  round: number,
): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'Room not found.' }
  const room = snap.data() as Room
  if (!room.members[uid]) return { error: 'Join the room before voting.' }
  if (room.status !== 'voting') return { error: 'Voting is closed.' }
  if (room.round !== round) return {} // stale round — client will resync

  // The slot must be a navigable path on the room's current node.
  const node = await getStoryNode(room.storyId, room.currentNodeId)
  const valid = navigableSlots(node?.slots).some((s) => s.id === slotId)
  if (!valid) return { error: 'That path is no longer available.' }

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const r = doc.data() as Room
    if (r.status !== 'voting' || r.round !== round) return
    txn.update(ref, { [`votes.${uid}`]: slotId, lastActivity: new Date().toISOString() })
  })
  return {}
}

export async function resolveRound(
  roomId: string,
  round: number,
  opts: { force?: boolean; byUid?: string } = {},
): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'Room not found.' }
  const room = snap.data() as Room

  if (room.status !== 'voting') return {}
  if (room.round !== round) return {} // already resolved by someone else
  if (opts.force && room.hostId !== opts.byUid) return { error: 'Only the host can skip the round.' }
  if (!opts.force && Date.now() < new Date(room.roundEndsAt).getTime()) return {} // not time yet

  const node = await getStoryNode(room.storyId, room.currentNodeId)
  const nav = navigableSlots(node?.slots)
  if (nav.length === 0) {
    await ref.update({ status: 'ended', lastActivity: new Date().toISOString() })
    return {}
  }

  // Tally votes over the currently navigable paths; highest wins, ties random.
  const counts: Record<string, number> = {}
  for (const votedSlot of Object.values(room.votes)) {
    counts[votedSlot] = (counts[votedSlot] ?? 0) + 1
  }
  let leaders: ChoiceSlot[] = []
  let best = -1
  for (const slot of nav) {
    const c = counts[slot.id] ?? 0
    if (c > best) {
      best = c
      leaders = [slot]
    } else if (c === best) {
      leaders.push(slot)
    }
  }
  const winner = leaders[Math.floor(Math.random() * leaders.length)]
  const newNodeId = winner.childNodeId as string

  let advanced = false
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const r = doc.data() as Room
    if (r.status !== 'voting' || r.round !== round) return
    txn.update(ref, {
      currentNodeId: newNodeId,
      round: round + 1,
      votes: {},
      roundEndsAt: new Date(Date.now() + r.roundSeconds * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
    })
    advanced = true
  })

  // If the destination is a dead-end (an ending), the tale is over.
  if (advanced) {
    const next = await getStoryNode(room.storyId, newNodeId)
    if (navigableSlots(next?.slots).length === 0) {
      await ref.update({ status: 'ended', lastActivity: new Date().toISOString() })
    }
  }
  return {}
}

export async function heartbeat(roomId: string, uid: string): Promise<void> {
  const ref = roomRef(roomId)
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) return
    const data = doc.data() as Room
    if (!data.members[uid]) return
    const now = new Date().toISOString()
    txn.update(ref, { [`members.${uid}.lastSeen`]: now, lastActivity: now })
  })
}

export async function getRoomStoryId(roomId: string): Promise<string | null> {
  const snap = await roomRef(roomId).get()
  return snap.exists ? ((snap.data() as Room).storyId ?? null) : null
}
