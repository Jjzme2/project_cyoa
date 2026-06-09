'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/Providers'
import { REACTION_TYPES, REACTION_LABELS } from '@/types'
import type { ReactionType } from '@/types'

interface Props {
  storyId: string
  nodeId: string
}

export function NodeReactions({ storyId, nodeId }: Props) {
  const { user, openAuthModal } = useAuth()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [userReactions, setUserReactions] = useState<string[]>([])
  const [toggling, setToggling] = useState<ReactionType | null>(null)

  useEffect(() => {
    async function load() {
      const token = user ? await user.getIdToken() : null
      const res = await fetch(`/api/stories/${storyId}/nodes/${nodeId}/react`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setCounts(data.counts ?? {})
        setUserReactions(data.userReactions ?? [])
      }
    }
    load()
  }, [storyId, nodeId, user])

  async function handleReact(reaction: ReactionType) {
    if (!user) {
      openAuthModal()
      return
    }
    if (toggling) return
    setToggling(reaction)

    const hasReacted = userReactions.includes(reaction)
    // Optimistic update
    setCounts((prev) => ({
      ...prev,
      [reaction]: Math.max(0, (prev[reaction] ?? 0) + (hasReacted ? -1 : 1)),
    }))
    setUserReactions((prev) =>
      hasReacted ? prev.filter((r) => r !== reaction) : [...prev, reaction],
    )

    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${storyId}/nodes/${nodeId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reaction }),
      })
      if (res.ok) {
        const data = await res.json()
        setCounts(data.counts ?? {})
        setUserReactions(data.userReactions ?? [])
      }
    } catch {
      // revert optimistic on failure
      setCounts((prev) => ({
        ...prev,
        [reaction]: Math.max(0, (prev[reaction] ?? 0) + (hasReacted ? 1 : -1)),
      }))
      setUserReactions((prev) =>
        hasReacted ? [...prev, reaction] : prev.filter((r) => r !== reaction),
      )
    } finally {
      setToggling(null)
    }
  }

  const totalReactions = REACTION_TYPES.reduce((s, r) => s + (counts[r] ?? 0), 0)
  if (totalReactions === 0 && !user) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-4 pt-3 border-t border-amber-900/15">
      {REACTION_TYPES.map((reaction) => {
        const count = counts[reaction] ?? 0
        const active = userReactions.includes(reaction)
        return (
          <button
            key={reaction}
            onClick={() => handleReact(reaction)}
            disabled={toggling === reaction}
            title={REACTION_LABELS[reaction]}
            className={`
              flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-sans border transition-all
              ${active
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                : 'border-white/10 text-muted-foreground/40 hover:border-white/20 hover:text-muted-foreground/70 bg-white/[0.02]'
              }
              ${toggling === reaction ? 'opacity-60' : ''}
            `}
          >
            <span className="text-sm leading-none">{reaction}</span>
            {count > 0 && <span className="text-[10px]">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
