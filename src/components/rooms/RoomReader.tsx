'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { doc, onSnapshot } from 'firebase/firestore'
import { toast } from 'sonner'
import { Loader2, Users, Share2, SkipForward, Check, Crown, BookOpen, BookOpenCheck, Feather, X } from 'lucide-react'
import { db } from '@/lib/firebase-client'
import { useAuth } from '@/components/Providers'
import { trackEvent } from '@/lib/track-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StoryContent } from '@/components/book/StoryContent'
import { LivingWorldPanel } from '@/components/book/LivingWorldPanel'
import type { Room, StoryNode } from '@/types'

const outlineLink =
  'inline-flex items-center justify-center rounded-md border border-white/15 px-3 py-1.5 text-xs font-sans text-foreground/80 hover:bg-white/5 transition-colors'

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}

export function RoomReader({ roomId }: { roomId: string }) {
  const { user, loading, openAuthModal } = useAuth()
  const [room, setRoom] = useState<Room | null>(null)
  const [roomMissing, setRoomMissing] = useState(false)
  const [node, setNode] = useState<StoryNode | null>(null)
  const [nodeLoading, setNodeLoading] = useState(false)
  const [ageBlocked, setAgeBlocked] = useState(false)
  const [voting, setVoting] = useState(false)
  const [writeText, setWriteText] = useState('')
  const [submittingWrite, setSubmittingWrite] = useState(false)
  const [markingReady, setMarkingReady] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // Gates the actual join call behind an explanation screen for first-time
  // visitors (see the interstitial below); already-known members skip it.
  const [joinConfirmed, setJoinConfirmed] = useState(false)

  // A returning member (e.g. refreshing mid-session) is already listed on the
  // room doc the moment it loads — derived, not stored, so it settles once
  // and never flip-flops on the frequent heartbeat-driven room updates.
  const isKnownMember = !!(user && room && room.members[user.uid])

  const joinedRef = useRef(false)
  const resolvedRoundRef = useRef(-1)
  const resolvedReadingRoundRef = useRef(-1)
  const fetchedNodeRef = useRef('')
  const openedTrackedRef = useRef<string | null>(null)

  // Analytics: a reader opened this story in a co-op room. Fire once per story,
  // tagged source:'room' to distinguish it from a solo read.
  useEffect(() => {
    const storyId = room?.storyId
    if (!user || !storyId || openedTrackedRef.current === storyId) return
    openedTrackedRef.current = storyId
    void trackEvent(user, 'story.opened', { props: { storyId, source: 'room', roomId } })
  }, [user, room?.storyId, roomId])

  const api = useCallback(
    async (path: string, body?: object) => {
      if (!user) throw new Error('Not signed in')
      const token = await user.getIdToken()
      const res = await fetch(`/api/rooms/${roomId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body ?? {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      return data
    },
    [user, roomId],
  )

  // Live subscription to the room doc.
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setRoomMissing(true)
          setRoom(null)
          return
        }
        setRoom({ id: snap.id, ...(snap.data() as Omit<Room, 'id'>) })
      },
      (err) => {
        console.error('[room] snapshot error', err)
        toast.error('Lost connection to the room.')
      },
    )
    return () => unsub()
  }, [user, roomId])

  // Join once confirmed — either a button click (first-time visitor) or
  // already being a known member (returning mid-session) — leave on unmount.
  // Deliberately does NOT depend on `room` itself: the doc updates on every
  // heartbeat, and re-running this effect would call the cleanup (leave!) on
  // every tick. `isKnownMember` is a derived boolean that settles once.
  useEffect(() => {
    if (!user || joinedRef.current || !(joinConfirmed || isKnownMember)) return
    joinedRef.current = true
    api('/join').catch((e: Error) => {
      if (e.message.includes('age_restricted')) setAgeBlocked(true)
      else toast.error(e.message)
    })
    return () => {
      api('/leave').catch(() => {})
    }
  }, [user, api, joinConfirmed, isKnownMember])

  // Presence heartbeat.
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => api('/heartbeat').catch(() => {}), 25_000)
    return () => clearInterval(id)
  }, [user, api])

  // Fetch the current chapter (age-gated) whenever the room advances.
  useEffect(() => {
    if (!user || !room) return
    if (fetchedNodeRef.current === room.currentNodeId) return
    fetchedNodeRef.current = room.currentNodeId
    setNodeLoading(true)
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch(`/api/stories/${room.storyId}/nodes?nodeId=${room.currentNodeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 403) {
          setAgeBlocked(true)
          return
        }
        const data = await res.json()
        if (res.ok) setNode(data.node)
      } catch {
        /* transient — snapshot will retrigger */
      } finally {
        setNodeLoading(false)
      }
    })()
  }, [user, room])

  // Ticking clock for the countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  // Auto-resolve once the round timer expires (server is idempotent).
  useEffect(() => {
    if (!room || room.status !== 'voting') return
    const ends = new Date(room.roundEndsAt).getTime()
    if (now >= ends && resolvedRoundRef.current !== room.round) {
      resolvedRoundRef.current = room.round
      api('/resolve', { round: room.round }).catch(() => {})
    }
  }, [now, room, api])

  // Auto-resolve the reading gate once its own timer expires — a separate ref
  // from the voting one above since a chapter's reading and voting phases
  // share the same round number.
  useEffect(() => {
    if (!room || room.status !== 'reading') return
    const ends = new Date(room.roundEndsAt).getTime()
    if (now >= ends && resolvedReadingRoundRef.current !== room.round) {
      resolvedReadingRoundRef.current = room.round
      api('/resolve', { round: room.round }).catch(() => {})
    }
  }, [now, room, api])

  async function vote(slotId: string) {
    if (!room) return
    setVoting(true)
    try {
      await api('/vote', { slotId, round: room.round })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record your vote')
    } finally {
      setVoting(false)
    }
  }

  // Acknowledge the current chapter as read (the "ready" gate).
  async function markRead() {
    if (!room) return
    setMarkingReady(true)
    try {
      await api('/ready', { round: room.round })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not mark this chapter as read')
    } finally {
      setMarkingReady(false)
    }
  }

  function share() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Room link copied — share it to read together.'))
      .catch(() => toast.error('Could not copy the link.'))
  }

  // Write a new path at a frontier (reuses the normal contribution endpoint),
  // then advance the whole room to it once it's published.
  async function submitWrite(slotId: string) {
    if (!user || !room || !writeText.trim()) return
    setSubmittingWrite(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${room.storyId}/nodes/${room.currentNodeId}/slots/${slotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ promptText: writeText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not write this path')
      setWriteText('')
      if (data.pendingReview) {
        toast.message('Submitted — your path needs moderation before the room can continue.')
      } else {
        await api('/advance', { toNodeId: data.nodeId })
        toast.success('The story continues, together!')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not write this path'
      // Benign in a room: someone else got there first (filled the slot, or
      // already advanced the room past it). The room's snapshot will pick up
      // their write and move everyone on — not a real failure.
      if (/already (filled|writing)|isn.t reachable/i.test(msg)) {
        toast.message('Someone else in the room just wrote this path — the story continues any moment.')
        setWriteText('')
      } else {
        toast.error(msg)
      }
    } finally {
      setSubmittingWrite(false)
    }
  }

  async function kick(targetUid: string) {
    try {
      await api('/kick', { targetUid })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove member')
    }
  }

  // ── Render states ───────────────────────────────────────────────────────
  if (loading) {
    return <Centered><Loader2 className="h-5 w-5 animate-spin opacity-50" /></Centered>
  }
  if (!user) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground/60">Sign in to join this reading room.</p>
        <Button size="sm" onClick={openAuthModal}>Sign in</Button>
      </Centered>
    )
  }
  if (ageBlocked) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground/70">
          This story’s content rating is above your age allowance, so you can’t join this room.
        </p>
      </Centered>
    )
  }
  if (roomMissing) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground/70">This room no longer exists.</p>
        <Link href="/stories" className={outlineLink}>Browse stories</Link>
      </Centered>
    )
  }
  if (!room) {
    return <Centered><Loader2 className="h-5 w-5 animate-spin opacity-50" /></Centered>
  }

  const members = Object.entries(room.members)

  // First-time visitor from a shared link: explain what joining actually
  // does before we add them as a member. Returning members skip straight past this.
  if (!isKnownMember && !joinConfirmed) {
    return (
      <Centered>
        <Users className="h-6 w-6 text-amber-400/60" />
        <p className="text-base font-medium text-foreground/85">Join “{room.storyTitle}” to read together</p>
        <p className="text-sm text-muted-foreground/65 max-w-sm">
          {members.length === 0
            ? 'You’ll be the first one here.'
            : `${members.length} ${members.length === 1 ? 'person is' : 'people are'} already here.`}{' '}
          Joining adds you to the room: everyone reads each chapter together, marks it as read (or waits out a
          short timer) before the group moves on, and votes together on what happens next. You can leave anytime
          — just close this tab.
        </p>
        <Button onClick={() => setJoinConfirmed(true)}>Join & start reading</Button>
        <Link href="/stories" className={outlineLink}>Not now</Link>
      </Centered>
    )
  }

  const navSlots = (node?.slots ?? []).filter((s) => s.filled && s.childNodeId)
  const openSlots = (node?.slots ?? []).filter((s) => !s.filled && !s.pendingReview)
  const totalVotes = Object.keys(room.votes).length
  const myVote = room.votes[user.uid]
  const isHost = room.hostId === user.uid
  const secondsLeft = Math.max(0, Math.ceil((new Date(room.roundEndsAt).getTime() - now) / 1000))
  const readyCount = members.filter(([uid]) => room.ready?.[uid]).length
  const myReady = !!room.ready?.[user.uid]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Room bar */}
      <div className="glass-card rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-4 w-4 text-amber-400/70 shrink-0" />
          <span className="text-sm font-medium text-foreground/80 truncate">{room.storyTitle}</span>
          <span className="text-[11px] text-muted-foreground/45 font-sans">· reading together</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {members.slice(0, 6).map(([uid, m]) => (
              <span
                key={uid}
                title={m.name}
                className="h-6 w-6 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-[9px] font-sans font-semibold text-amber-200"
              >
                {initials(m.name)}
              </span>
            ))}
            {members.length > 6 && (
              <span className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-sans text-muted-foreground/60">
                +{members.length - 6}
              </span>
            )}
          </div>
          <button onClick={share} title="Copy room link" className="text-muted-foreground/50 hover:text-amber-300 transition-colors">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chapter */}
      <div className="book-page page-texture rounded-xl p-6 sm:p-10 min-h-[320px]">
        {nodeLoading && !node ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin opacity-40" /></div>
        ) : node ? (
          <StoryContent content={node.content} depth={node.depth} choiceText={node.choiceText} imageUrl={node.imageUrl} />
        ) : (
          <p className="text-sm text-muted-foreground/50 text-center py-12">Loading the chapter…</p>
        )}
      </div>

      {node?.worldPulse && <LivingWorldPanel pulse={node.worldPulse} />}

      {/* Reading gate / ended / writing / voting */}
      {room.status === 'reading' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest font-sans text-amber-400/55">
              Catching everyone up
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-sans text-muted-foreground/55 tabular-nums">
                {secondsLeft}s · {readyCount}/{members.length} ready
              </span>
              {isHost && (
                <button
                  onClick={() => api('/resolve', { round: room.round, force: true }).catch((e: Error) => toast.error(e.message))}
                  className="flex items-center gap-1 text-[11px] font-sans text-amber-400/70 hover:text-amber-300 transition-colors"
                  title="Skip the wait and continue now"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Skip
                </button>
              )}
            </div>
          </div>
          <Button
            onClick={markRead}
            disabled={markingReady || myReady}
            className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 disabled:opacity-80"
          >
            {myReady ? <Check className="h-4 w-4" /> : markingReady ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
            {myReady ? 'You’re ready — waiting on the others' : 'I’ve read this — ready to continue'}
          </Button>
          <p className="text-[10px] font-sans text-muted-foreground/40 text-center">
            Once everyone’s marked ready (or the timer ends), the room moves on together.
          </p>
        </div>
      ) : room.status === 'ended' ? (
        <div className="glass-card rounded-xl p-6 text-center space-y-3">
          <BookOpen className="h-6 w-6 mx-auto text-amber-400/60" />
          <p className="text-sm text-foreground/75">Your tale has reached its end, together.</p>
          <p className="text-[11px] font-sans text-muted-foreground/45">
            {room.round} {room.round === 1 ? 'chapter' : 'chapters'} ·{' '}
            {members.length} {members.length === 1 ? 'reader' : 'readers'}
          </p>
          <Link href={`/stories/${room.storyId}`} className={outlineLink}>Read this story on your own</Link>
        </div>
      ) : room.status === 'writing' ? (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest font-sans text-amber-400/55">
            A frontier — write what happens next, together
          </p>
          {openSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 py-4 text-center">Waiting for an open path…</p>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={writeText}
                onChange={(e) => setWriteText(e.target.value)}
                placeholder="Describe the path the group takes next…"
                rows={4}
                disabled={submittingWrite}
              />
              <Button
                onClick={() => submitWrite(openSlots[0].id)}
                disabled={submittingWrite || !writeText.trim()}
                className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
              >
                {submittingWrite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Feather className="h-4 w-4" />}
                {submittingWrite ? 'Weaving the tale…' : 'Write & continue'}
              </Button>
              <p className="text-[10px] font-sans text-muted-foreground/40 text-center">
                Anyone in the room can write; the first published path continues the story for everyone.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest font-sans text-amber-400/55">
              Vote — what happens next?
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-sans text-muted-foreground/55 tabular-nums">
                {secondsLeft}s · {totalVotes}/{members.length} voted
              </span>
              {isHost && (
                <button
                  onClick={() => api('/resolve', { round: room.round, force: true }).catch((e: Error) => toast.error(e.message))}
                  className="flex items-center gap-1 text-[11px] font-sans text-amber-400/70 hover:text-amber-300 transition-colors"
                  title="Skip the timer and advance now"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Skip
                </button>
              )}
            </div>
          </div>

          {navSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 py-4 text-center">
              No written paths here yet — waiting for the story to grow.
            </p>
          ) : (
            navSlots.map((slot) => {
              const count = Object.values(room.votes).filter((v) => v === slot.id).length
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
              const mine = myVote === slot.id
              return (
                <button
                  key={slot.id}
                  onClick={() => vote(slot.id)}
                  disabled={voting}
                  className={`relative w-full text-left rounded-lg border px-4 py-3 overflow-hidden transition-all ${
                    mine ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-500/10 transition-all"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <span className="text-[13.5px] leading-snug text-foreground/85">{slot.promptText}</span>
                    <span className="flex items-center gap-1.5 shrink-0 text-[11px] font-sans text-muted-foreground/60 tabular-nums">
                      {mine && <Check className="h-3.5 w-3.5 text-amber-400" />}
                      {count}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* Members list */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {members.map(([uid, m]) => (
          <span
            key={uid}
            className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-muted-foreground/55"
          >
            {room.hostId === uid && <Crown className="h-2.5 w-2.5 text-amber-400/70" />}
            {m.name}
            {isHost && room.hostId !== uid && (
              <button
                onClick={() => kick(uid)}
                title={`Remove ${m.name}`}
                className="ml-0.5 opacity-40 hover:opacity-100 hover:text-red-400 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 py-24 text-center">
      {children}
    </div>
  )
}
