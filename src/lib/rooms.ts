import { adminDb } from './firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getStory, getStoryNode } from './firestore-helpers'
import type { Room, RoomMember, RoomStatus, ChoiceSlot } from '@/types'

/**
 * Co-op reading rooms.
 *
 * All mutations run server-side through the Admin SDK; clients only ever read
 * the room doc (via onSnapshot) per the `rooms` security rules. Round
 * resolution is idempotent — guarded by the round number — so any client whose
 * countdown expires can safely trigger it and only the first call advances.
 */

export const ROUND_SECONDS = 30
/** How long the room waits on the "mark as read" gate before moving on regardless. */
export const READING_SECONDS = 60
export const MAX_MEMBERS = 20
/** A member is considered present if they've sent a heartbeat within this window. */
export const STALE_MS = 90_000

function roomRef(roomId: string) {
  return adminDb.collection('rooms').doc(roomId)
}

/** Open paths a member could write at a frontier node. */
function openSlots(slots: ChoiceSlot[] | undefined): ChoiceSlot[] {
  return (slots ?? []).filter((s) => !s.filled && !s.pendingReview)
}

/**
 * The room's REAL status implied by a node once the reading gate clears: vote
 * when there are written paths, pause to write at a frontier with open slots,
 * otherwise the tale has ended.
 */
async function statusForNode(storyId: string, nodeId: string): Promise<RoomStatus> {
  const node = await getStoryNode(storyId, nodeId)
  if (navigableSlots(node?.slots).length > 0) return 'voting'
  if (openSlots(node?.slots).length > 0) return 'writing'
  return 'ended'
}

/**
 * Called whenever the room arrives at a NEW chapter (creation, a resolved
 * vote, or a fresh in-room write). Ending nodes skip the gate entirely —
 * there's nothing to advance to. Otherwise the room pauses on 'reading' so
 * everyone can catch up before voting/writing starts; `pendingStatus` records
 * what to become once the gate resolves (see {@link resolveReading}).
 */
async function enterNode(ref: FirebaseFirestore.DocumentReference, storyId: string, nodeId: string): Promise<void> {
  const next = await statusForNode(storyId, nodeId)
  const now = new Date()
  if (next === 'ended') {
    await ref.update({
      status: 'ended',
      endedReason: 'story',
      pendingStatus: FieldValue.delete(),
      lastActivity: now.toISOString(),
    })
    return
  }
  await ref.update({
    status: 'reading',
    pendingStatus: next,
    endedReason: FieldValue.delete(),
    ready: {},
    roundEndsAt: new Date(now.getTime() + READING_SECONDS * 1000).toISOString(),
    lastActivity: now.toISOString(),
  })
}

/**
 * Drops members who haven't sent a heartbeat within STALE_MS and returns the
 * dotted-path updates to apply. Ends the room if everyone has gone. Mutates
 * `data.members` so callers can reason about who remains.
 */
function pruneStaleMembers(data: Room, update: Record<string, unknown>): void {
  const cutoff = Date.now() - STALE_MS
  let host = data.hostId
  for (const [uid, m] of Object.entries(data.members)) {
    if (new Date(m.lastSeen).getTime() < cutoff) {
      update[`members.${uid}`] = FieldValue.delete()
      update[`votes.${uid}`] = FieldValue.delete()
      update[`ready.${uid}`] = FieldValue.delete()
      delete data.members[uid]
      if (uid === host) host = ''
    }
  }
  const remaining = Object.keys(data.members)
  if (remaining.length === 0) {
    update.status = 'ended'
    update.endedReason = 'empty'
  } else if (!host) {
    update.hostId = remaining[0] // promote someone if the host went stale
  }
}

interface Actor {
  uid: string
  name: string | null
  photo?: string | null
  isAnonymous?: boolean
}

/** Filled paths a room can navigate to from a node. */
function navigableSlots(slots: ChoiceSlot[] | undefined): ChoiceSlot[] {
  return (slots ?? []).filter((s) => s.filled && s.childNodeId)
}

function member(actor: Actor): RoomMember {
  return {
    name: actor.name ?? (actor.isAnonymous ? 'Guest' : 'Anonymous'),
    photo: actor.photo ?? null,
    lastSeen: new Date().toISOString(),
    ...(actor.isAnonymous ? { guest: true } : {}),
  }
}

export async function createRoom(
  storyId: string,
  host: Actor,
): Promise<{ roomId?: string; error?: string }> {
  const story = await getStory(storyId)
  if (!story) return { error: 'Story not found.' }
  if (!story.rootNodeId) return { error: 'This story has no opening chapter yet.' }

  const now = new Date()
  // Vote if there are written paths, pause to write at a frontier, else ended —
  // gated behind the 'reading' phase unless the opening chapter is already the end.
  const next = await statusForNode(storyId, story.rootNodeId)
  const status: RoomStatus = next === 'ended' ? 'ended' : 'reading'

  const room: Omit<Room, 'id'> = {
    storyId,
    storyTitle: story.title,
    hostId: host.uid,
    status,
    ...(status === 'reading' ? { pendingStatus: next } : { endedReason: 'story' as const }),
    currentNodeId: story.rootNodeId,
    round: 1,
    roundEndsAt: new Date(now.getTime() + (status === 'reading' ? READING_SECONDS : ROUND_SECONDS) * 1000).toISOString(),
    roundSeconds: ROUND_SECONDS,
    members: { [host.uid]: member(host) },
    votes: {},
    ready: {},
    createdAt: now.toISOString(),
    lastActivity: now.toISOString(),
  }
  const ref = await adminDb.collection('rooms').add(room)
  return { roomId: ref.id }
}

type Revive = { storyId: string; currentNodeId: string } | null

export async function joinRoom(roomId: string, actor: Actor): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  let error: string | undefined

  // Non-null only when a rejoin lands on a room that "ended" purely because
  // everyone left (not a genuine story conclusion) — revived right after.
  const revive = await adminDb.runTransaction<Revive>(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) {
      error = 'Room not found.'
      return null
    }
    const data = doc.data() as Room
    const now = new Date().toISOString()
    // Keep the joiner fresh so pruning never targets them (avoids a
    // delete+set conflict on the same member field).
    if (data.members[actor.uid]) data.members[actor.uid].lastSeen = now
    const update: Record<string, unknown> = { lastActivity: now }
    pruneStaleMembers(data, update)

    const wasEmptyEnded = data.status === 'ended' && data.endedReason === 'empty'
    const revive: Revive = wasEmptyEnded ? { storyId: data.storyId, currentNodeId: data.currentNodeId } : null

    if (data.members[actor.uid]) {
      // Already a member — just refresh presence. Also correct the guest flag
      // in place: a guest who registered (Firebase account linking keeps the
      // same uid) should stop showing as one without having to re-join.
      update[`members.${actor.uid}.lastSeen`] = now
      if (!!data.members[actor.uid].guest !== !!actor.isAnonymous) {
        update[`members.${actor.uid}.guest`] = !!actor.isAnonymous
      }
      delete update.status // rejoining keeps the room alive
      delete update.endedReason
      txn.update(ref, update)
      return revive
    }
    if (Object.keys(data.members).length >= MAX_MEMBERS) {
      error = 'This room is full.'
      return null
    }
    update[`members.${actor.uid}`] = member(actor)
    delete update.status // a new member keeps the room alive
    delete update.endedReason
    txn.update(ref, update)
    return revive
  })

  // A room that only "ended" because everyone left is revived to wherever the
  // story actually is — a genuine story conclusion is never revived this way.
  if (!error && revive) {
    await enterNode(ref, revive.storyId, revive.currentNodeId)
  }
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
      [`ready.${uid}`]: FieldValue.delete(),
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
    // A path was unwritten under us (e.g. moderation reject) — re-derive state.
    const status = await statusForNode(room.storyId, room.currentNodeId)
    await ref.update({ status, lastActivity: new Date().toISOString() })
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
      lastActivity: new Date().toISOString(),
    })
    advanced = true
  })

  // Arriving at a new chapter: gate on 'reading' (or 'ended' if this is the close).
  if (advanced) {
    await enterNode(ref, room.storyId, newNodeId)
  }
  return {}
}

/**
 * Resolve the reading gate on the current chapter once everyone's marked it
 * read, or (like {@link resolveRound}) the timer runs out — idempotent and
 * safe for any client to call. `force` lets the host skip the wait early.
 */
export async function resolveReading(
  roomId: string,
  round: number,
  opts: { force?: boolean; byUid?: string } = {},
): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'Room not found.' }
  const room = snap.data() as Room

  if (room.status !== 'reading') return {}
  if (room.round !== round) return {} // already resolved by someone else
  if (opts.force && room.hostId !== opts.byUid) return { error: 'Only the host can skip the wait.' }

  const memberIds = Object.keys(room.members)
  const allReady = memberIds.length > 0 && memberIds.every((uid) => room.ready?.[uid])
  const timeUp = Date.now() >= new Date(room.roundEndsAt).getTime()
  if (!opts.force && !allReady && !timeUp) return {} // still waiting

  const nextStatus: RoomStatus = room.pendingStatus ?? 'ended'
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const r = doc.data() as Room
    if (r.status !== 'reading' || r.round !== round) return
    txn.update(ref, {
      status: nextStatus,
      pendingStatus: FieldValue.delete(),
      ready: {},
      votes: {},
      roundEndsAt: new Date(Date.now() + r.roundSeconds * 1000).toISOString(),
      lastActivity: new Date().toISOString(),
    })
  })
  return {}
}

/** Acknowledge the current chapter as read. Idempotent; ignored once the gate's already resolved. */
export async function markReady(roomId: string, uid: string, round: number): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'Room not found.' }
  const room = snap.data() as Room
  if (!room.members[uid]) return { error: 'Join the room first.' }
  if (room.status !== 'reading' || room.round !== round) return {} // stale — client will resync

  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    const r = doc.data() as Room
    if (r.status !== 'reading' || r.round !== round) return
    txn.update(ref, { [`ready.${uid}`]: true, lastActivity: new Date().toISOString() })
  })
  return {}
}

/**
 * Advance the room to a freshly written child node (after an in-room
 * contribution fills a frontier slot). Validates the target really is a written
 * path off the current node to prevent arbitrary jumps.
 */
export async function advanceRoom(
  roomId: string,
  toNodeId: string,
): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  const snap = await ref.get()
  if (!snap.exists) return { error: 'Room not found.' }
  const room = snap.data() as Room
  if (room.status === 'ended') return {}

  // The target must be a filled path on the room's current node.
  const node = await getStoryNode(room.storyId, room.currentNodeId)
  const isChild = navigableSlots(node?.slots).some((s) => s.childNodeId === toNodeId)
  if (!isChild) return { error: 'That path isn’t reachable from here yet.' }

  await ref.update({
    currentNodeId: toNodeId,
    round: room.round + 1,
    votes: {},
    lastActivity: new Date().toISOString(),
  })
  await enterNode(ref, room.storyId, toNodeId)
  return {}
}

/** Host-only: remove a member from the room. */
export async function kickMember(
  roomId: string,
  hostUid: string,
  targetUid: string,
): Promise<{ error?: string }> {
  const ref = roomRef(roomId)
  let error: string | undefined
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) {
      error = 'Room not found.'
      return
    }
    const data = doc.data() as Room
    if (data.hostId !== hostUid) {
      error = 'Only the host can remove members.'
      return
    }
    if (targetUid === hostUid || !data.members[targetUid]) return
    txn.update(ref, {
      [`members.${targetUid}`]: FieldValue.delete(),
      [`votes.${targetUid}`]: FieldValue.delete(),
      [`ready.${targetUid}`]: FieldValue.delete(),
      lastActivity: new Date().toISOString(),
    })
  })
  return { error }
}

export async function heartbeat(roomId: string, uid: string): Promise<void> {
  const ref = roomRef(roomId)
  await adminDb.runTransaction(async (txn) => {
    const doc = await txn.get(ref)
    if (!doc.exists) return
    const data = doc.data() as Room
    if (!data.members[uid]) return
    const now = new Date().toISOString()
    // This member is alive (they're beating); keep them fresh before pruning so
    // pruning never targets them (avoids a delete+set conflict).
    data.members[uid].lastSeen = now
    const update: Record<string, unknown> = { lastActivity: now }
    pruneStaleMembers(data, update)
    update[`members.${uid}.lastSeen`] = now
    delete update.status
    txn.update(ref, update)
  })
}

export async function getRoomStoryId(roomId: string): Promise<string | null> {
  const snap = await roomRef(roomId).get()
  return snap.exists ? ((snap.data() as Room).storyId ?? null) : null
}

export interface ActiveRoomListing {
  id: string
  storyId: string
  storyTitle: string
  status: RoomStatus
  memberCount: number
}

/**
 * The rooms lobby: active (non-ended) rooms, most-recently-active first. A
 * plain `orderBy('lastActivity')` avoids needing a composite index — 'ended'
 * rooms are filtered out in memory rather than via an inequality WHERE, which
 * would need one. Bounded scan, same trade-off as the character/admin lists.
 */
export async function listActiveRooms(limit = 30): Promise<ActiveRoomListing[]> {
  const snap = await adminDb.collection('rooms').orderBy('lastActivity', 'desc').limit(limit * 2).get()
  const active = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Room, 'id'>) }))
    .filter((r) => r.status !== 'ended')

  // Unlisted stories are hidden from public listings — their rooms stay reachable
  // by direct link but must not surface (title or existence) in the public lobby.
  const storyIds = Array.from(new Set(active.map((r) => r.storyId)))
  const stories = await Promise.all(storyIds.map((id) => getStory(id).catch(() => null)))
  const listable = new Set(storyIds.filter((id, i) => stories[i] && !stories[i]!.unlisted))

  return active
    .filter((r) => listable.has(r.storyId))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      storyId: r.storyId,
      storyTitle: r.storyTitle,
      status: r.status,
      memberCount: Object.keys(r.members ?? {}).length,
    }))
}
