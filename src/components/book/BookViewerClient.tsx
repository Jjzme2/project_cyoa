'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { Story, StoryNode, WorldBible, AmbientEffect } from '@/types'

const BookViewer = dynamic(
  () => import('@/components/book/BookViewer').then((m) => m.BookViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-4xl mx-auto">
        <Skeleton className="h-[560px] rounded-2xl shimmer" />
      </div>
    ),
  },
)

interface Props {
  story: Story
  initialNode: StoryNode
  endingCount?: number
  worldGenesis?: WorldBible
  worldSeed?: number
  worldAmbientEffect?: AmbientEffect
}

export function BookViewerClient({ story, initialNode, endingCount, worldGenesis, worldSeed, worldAmbientEffect }: Props) {
  return (
    <BookViewer
      story={story}
      initialNode={initialNode}
      endingCount={endingCount}
      worldGenesis={worldGenesis}
      worldSeed={worldSeed}
      worldAmbientEffect={worldAmbientEffect}
    />
  )
}
