'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { Story, StoryNode } from '@/types'

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
}

export function BookViewerClient({ story, initialNode }: Props) {
  return <BookViewer story={story} initialNode={initialNode} />
}
