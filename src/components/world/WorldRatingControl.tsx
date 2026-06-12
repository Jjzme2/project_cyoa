'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/Providers'
import { CONTENT_RATINGS, CONTENT_RATING_META, DEFAULT_CONTENT_RATING } from '@/types'
import type { ContentRating } from '@/types'

interface Props {
  worldId: string
  authorId: string
  rating?: ContentRating
}

/**
 * Displays a world's content rating. The world's creator can set it; an admin
 * can override any world's rating (the server records the override).
 */
export function WorldRatingControl({ worldId, authorId, rating: initialRating }: Props) {
  const { user, isAdmin } = useAuth()
  const [rating, setRating] = useState<ContentRating>(initialRating ?? DEFAULT_CONTENT_RATING)
  const [saving, setSaving] = useState(false)

  const isOwner = !!user && user.uid === authorId
  const canEdit = isOwner || isAdmin
  const meta = CONTENT_RATING_META[rating]

  async function change(next: ContentRating) {
    if (!user || next === rating) return
    const prev = rating
    setRating(next)
    setSaving(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch(`/api/worlds/${worldId}`, {
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

  const badge = (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-sans font-semibold px-2 py-0.5 rounded-full border ${meta.className}`}
      title={meta.description}
    >
      {rating} <span className="opacity-60">({meta.abbr})</span>
    </span>
  )

  if (!canEdit) return badge

  return (
    <span className="inline-flex items-center gap-2">
      {badge}
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
        {isAdmin && !isOwner && (
          <ShieldCheck className="h-3 w-3 text-amber-400/70" aria-label="Admin override" />
        )}
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
    </span>
  )
}
