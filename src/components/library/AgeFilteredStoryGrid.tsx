'use client'

import { useMemo } from 'react'
import { StoryCard } from '@/components/StoryCard'
import { useAuth } from '@/components/Providers'
import { ratingRank } from '@/lib/ratings'
import type { Story } from '@/types'

/** Renders a story grid, hiding any story rated above the viewer's allowance. */
export function AgeFilteredStoryGrid({ stories }: { stories: Story[] }) {
  const { allowedRank } = useAuth()
  const visible = useMemo(
    () => stories.filter((s) => ratingRank(s.rating) <= allowedRank),
    [stories, allowedRank],
  )

  if (visible.length === 0) {
    return (
      <p className="text-center py-12 text-muted-foreground/40 text-sm">
        No stories available for your age rating yet.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 sm:gap-5">
      {visible.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
    </div>
  )
}
