'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { RatingBadge } from '@/components/ContentBadges'
import { CONTENT_RATINGS, DEFAULT_CONTENT_RATING } from '@/types'
import type { ContentRating } from '@/types'

interface Props {
  storyId: string
  authorId: string
  rating?: ContentRating
}

/**
 * Shows a story's content rating. The author can set it; an admin can override
 * any story's rating (the server records the override).
 */
export function StoryRatingControl({ storyId, authorId, rating: initialRating }: Props) {
  const { user, isAdmin } = useAuth()
  const [rating, setRating] = useState<ContentRating>(initialRating ?? DEFAULT_CONTENT_RATING)
  const [saving, setSaving] = useState(false)

  const isOwner = !!user && user.uid === authorId
  const canEdit = isOwner || isAdmin

  async function change(next: ContentRating) {
    if (!user || next === rating) return
    const prev = rating
    setRating(next)
    setSaving(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/stories/${storyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating: next }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update rating')
      toast.success(`Content rating set to ${next}.`)
    } catch (err) {
      setRating(prev)
      toast.error(err instanceof Error ? err.message : 'Failed to update rating')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) return <RatingBadge rating={rating} />

  return (
    <span className="inline-flex items-center gap-1.5">
      <RatingBadge rating={rating} />
      {isAdmin && !isOwner && <ShieldCheck className="h-3 w-3 text-amber-400/70" aria-label="Admin override" />}
      <select
        value={rating}
        disabled={saving}
        onChange={(e) => change(e.target.value as ContentRating)}
        className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Set content rating"
      >
        {CONTENT_RATINGS.map((r) => (
          <option key={r} value={r} className="bg-background">
            {r}
          </option>
        ))}
      </select>
      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
    </span>
  )
}
