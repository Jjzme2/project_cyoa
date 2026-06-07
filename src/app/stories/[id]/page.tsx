import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { BookViewerClient } from '@/components/book/BookViewerClient'
import { getStory, getStoryNode, incrementStoryViews } from '@/lib/firestore-helpers'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const story = await getStory(id).catch(() => null)
  if (!story) return { title: 'Story not found — Chronicle' }
  return {
    title: `${story.title} — Chronicle`,
    description:
      story.description || `A community CYOA story set in the world of ${story.worldName}.`,
  }
}

export default async function StoryPage({ params }: Props) {
  const { id } = await params
  const story = await getStory(id).catch(() => null)
  if (!story) notFound()

  const rootNode = story.rootNodeId
    ? await getStoryNode(id, story.rootNodeId).catch(() => null)
    : null

  after(() => incrementStoryViews(id).catch(() => {}))

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1 max-w-2xl">
        <p className="text-[11px] text-amber-400/45 uppercase tracking-widest font-sans">
          {story.worldName}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold gold-text leading-tight">{story.title}</h1>
        {story.description && (
          <p className="text-muted-foreground/55 text-sm mt-2">{story.description}</p>
        )}
        <p className="text-xs text-muted-foreground/35 font-sans">by {story.authorName}</p>
      </div>

      {/* Book */}
      {rootNode ? (
        <BookViewerClient story={story} initialNode={rootNode} />
      ) : (
        <div className="glass-card rounded-2xl p-14 text-center">
          <p className="text-muted-foreground/45 text-sm">
            This story doesn&apos;t have an opening chapter yet.
          </p>
        </div>
      )}
    </main>
  )
}
