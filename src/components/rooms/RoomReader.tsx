'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { doc, onSnapshot } from 'firebase/firestore'
import { toast } from 'sonner'
import { Loader2, Users, Share2, SkipForward, Check, Crown, BookOpen } from 'lucide-react'
import { db } from '@/lib/firebase-client'
import { useAuth } from '@/components/Providers'
import { Button } from '@/components/ui/button'
import { StoryContent } from '@/components/book/StoryContent'
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
  const [now, setNow] = useState(() => Date.now())

  const joinedRef = useRef(false)
  const resolvedRoundRef = useRef(-1)
  const fetchedNodeRef = useRef('')

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

  // Join on mount, leave on unmount.
  useEffect(() => {
    if (!user || joinedRef.current) return
    joinedRef.current = true
    api('/join').catch((e: Error) => {
      if (e.message.includes('age_restricted')) setAgeBlocked(true)
      else toast.error(e.message)
    })
    return () => {
      api('/leave').catch(() => {})
    }
  }, [user, api])

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

  function share() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Room link copied — share it to read together.'))
      .catch(() => toast.error('Could not copy the link.'))
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
  const navSlots = (node?.slots ?? []).filter((s) => s.filled && s.childNodeId)
  const totalVotes = Object.keys(room.votes).length
  const myVote = room.votes[user.uid]
  const isHost = room.hostId === user.uid
  const secondsLeft = Math.max(0, Math.ceil((new Date(room.roundEndsAt).getTime() - now) / 1000))

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

      {/* Voting / ended */}
      {room.status === 'ended' ? (
        <div className="glass-card rounded-xl p-6 text-center space-y-3">
          <BookOpen className="h-6 w-6 mx-auto text-amber-400/60" />
          <p className="text-sm text-foreground/75">Your tale has reached its end, together.</p>
          <Link href={`/stories/${room.storyId}`} className={outlineLink}>Read this story on your own</Link>
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
