import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { BookViewerClient } from '@/components/book/BookViewerClient'
import { GatedStoryReader } from '@/components/book/GatedStoryReader'
import { StoryRatingControl } from '@/components/story/StoryRatingControl'
import { SeededBadge } from '@/components/ContentBadges'
import { Skeleton } from '@/components/ui/skeleton'
import { getStory, getStoryNode, incrementStoryViews } from '@/lib/firestore-helpers'
import { ratingRank } from '@/lib/ratings'
import { APP_CONFIG } from '@/lib/config'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const story = await getStory(id).catch(() => null)
  if (!story) return { title: 'Story not found' }

  const title = story.title
  const description =
    story.description || `A community CYOA story set in the world of ${story.worldName}.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: APP_CONFIG.site.name },
    twitter: { card: 'summary_large_image', title, description },
  }
}

async function StoryContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = await getStory(id).catch(() => null)
  if (!story) notFound()

  // Teen/Mature stories are never rendered on the server; the client gate
  // resolves the viewer's age first (see GatedStoryReader).
  const gated = ratingRank(story.rating) > 0
  const rootNode =
    !gated && story.rootNodeId
      ? await getStoryNode(id, story.rootNodeId).catch(() => null)
      : null

  after(() => incrementStoryViews(id).catch(() => {}))

  return (
    <>
      <div className="space-y-1 max-w-2xl">
        <p className="text-[11px] text-amber-400/45 uppercase tracking-widest font-sans">
          {story.worldName}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold gold-text leading-tight">{story.title}</h1>
        {story.description && (
          <p className="text-muted-foreground/55 text-sm mt-2">{story.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs text-muted-foreground/35 font-sans">by {story.authorName}</span>
          {story.seeded && <SeededBadge />}
          <StoryRatingControl storyId={story.id} authorId={story.authorId} rating={story.rating} />
        </div>
      </div>

      {gated ? (
        <GatedStoryReader story={story} />
      ) : rootNode ? (
        <BookViewerClient story={story} initialNode={rootNode} />
      ) : (
        <div className="glass-card rounded-2xl p-14 text-center">
          <p className="text-muted-foreground/45 text-sm">
            This story doesn&apos;t have an opening chapter yet.
          </p>
        </div>
      )}
    </>
  )
}

function StoryContentSkeleton() {
  return (
    <>
      <div className="space-y-2 max-w-2xl">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40 mt-2" />
      </div>
      <div className="glass-card rounded-2xl min-h-[640px] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-900/25 border-t-amber-800/70 rounded-full animate-spin" />
      </div>
    </>
  )
}

// Synchronous page shell — all dynamic work is inside the Suspense boundary
export default function StoryPage({ params }: Props) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Suspense fallback={<StoryContentSkeleton />}>
        <StoryContent params={params} />
      </Suspense>
    </main>
  )
}
