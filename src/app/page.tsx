import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, Library } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LibraryClient } from '@/components/library/LibraryClient'
import { ContinueReadingSection } from '@/components/library/ContinueReadingSection'
import { getStories } from '@/lib/firestore-helpers'

async function LibraryContent() {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories')

  let stories
  try {
    stories = await getStories(200)
  } catch {
    return (
      <div className="text-center py-16 text-muted-foreground/40 text-sm">
        Could not load stories — check your Firebase configuration.
      </div>
    )
  }
  return <LibraryClient stories={stories} />
}

function LibrarySkeleton() {
  return (
    <div className="space-y-16">
      {[7, 5].map((count, section) => (
        <div key={section}>
          {/* Section header placeholder */}
          <div className="flex items-center gap-4 mb-7">
            <div className="h-5 w-44 rounded bg-white/5 shimmer" />
            <div className="flex-1 h-px bg-white/5" />
          </div>
          {/* Book grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 sm:gap-5 pb-6">
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton
                key={i}
                className="rounded-sm shimmer"
                style={{ aspectRatio: '2/3' }}
              />
            ))}
          </div>
          {/* Shelf placeholder */}
          <div className="h-5 -mx-1 rounded-sm bg-white/5" />
        </div>
      ))}
    </div>
  )
}

export default function LibraryPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      {/* Hero */}
      <section className="py-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-400/50 text-xs uppercase tracking-widest font-sans">
            <Library className="h-3.5 w-3.5" />
            Community CYOA Library
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            <span className="gold-text">Every story</span>
            <br />
            <span className="text-foreground/75">written together.</span>
          </h1>
          <p className="text-muted-foreground/60 max-w-md text-sm leading-relaxed">
            Browse the shelves. Pull any book to begin reading — every choice you write
            becomes a new chapter for others to discover.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/stories/new">
            <Button className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300">
              <Plus className="h-4 w-4" />
              Start a story
            </Button>
          </Link>
          <Link href="/worlds/new">
            <Button
              variant="ghost"
              className="gap-2 text-muted-foreground/60 hover:text-foreground"
            >
              <Sparkles className="h-4 w-4" />
              Create a world
            </Button>
          </Link>
        </div>
      </section>

      <div className="border-t border-white/[0.07]" />

      {/* Personalised shelves: Continue Reading + Bookmarks (client, auth-gated) */}
      <ContinueReadingSection />

      {/* Interactive library shelves */}
      <section>
        <Suspense fallback={<LibrarySkeleton />}>
          <LibraryContent />
        </Suspense>
      </section>
    </main>
  )
}
