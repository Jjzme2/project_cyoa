import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, Library, BookOpen, MousePointerClick, PenLine } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LibraryClient, type WorldChrome } from '@/components/library/LibraryClient'
import { ContinueReadingSection } from '@/components/library/ContinueReadingSection'
import { InteractiveTeaser, type TeaserChoice } from '@/components/home/InteractiveTeaser'
import { getStories, getPublicWorlds, getStoryNode } from '@/lib/firestore-helpers'

async function LibraryContent() {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories')
  cacheTag('worlds')

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

  // The visual identity for each world, keyed by name so shelves (grouped by
  // world name) can show the world's banner. Worlds load best-effort: a failure
  // here just falls back to the plain text shelf headers.
  let worldChrome: Record<string, WorldChrome> = {}
  try {
    const worlds = await getPublicWorlds(200)
    worldChrome = Object.fromEntries(
      worlds.map((w) => [w.name, { theme: w.theme, tone: w.tone }]),
    )
  } catch {
    worldChrome = {}
  }

  return <LibraryClient stories={stories} worldChrome={worldChrome} />
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

/**
 * Reader-first hero actions. The primary call-to-action drops a first-time
 * visitor straight into a chapter (the most-read story) before asking them to
 * create anything. Falls back to the creation CTAs if the library is empty.
 */
async function HeroActions() {
  'use cache'
  cacheLife('minutes')
  cacheTag('stories')

  let featuredId: string | null = null
  let featuredTitle = ''
  let teaser: { excerpt: string; choices: TeaserChoice[] } | null = null
  try {
    const stories = await getStories(30)
    if (stories.length > 0) {
      // Prefer an Everyone-rated pick so the interactive excerpt below can
      // actually be fetched by a signed-out first-time visitor; fall back to
      // the overall most-viewed story if none qualify.
      const pool = stories.filter((s) => (s.rating ?? 'Everyone') === 'Everyone')
      const candidates = pool.length > 0 ? pool : stories
      const featured = candidates.reduce(
        (top, s) => ((s.views ?? 0) > (top.views ?? 0) ? s : top),
        candidates[0],
      )
      featuredId = featured.id
      featuredTitle = featured.title

      if (featured.rootNodeId) {
        const root = await getStoryNode(featured.id, featured.rootNodeId).catch(() => null)
        const choices: TeaserChoice[] = (root?.slots ?? [])
          .filter((s) => s.filled && s.childNodeId && s.promptText)
          .slice(0, 3)
          .map((s) => ({ id: s.id, promptText: s.promptText as string, childNodeId: s.childNodeId as string }))
        if (root?.content && choices.length >= 2) {
          teaser = { excerpt: root.content.slice(0, 260).trim(), choices }
        }
      }
    }
  } catch {
    featuredId = null
  }

  return (
    <div className="space-y-4">
      {teaser && featuredId && (
        <InteractiveTeaser storyId={featuredId} storyTitle={featuredTitle} excerpt={teaser.excerpt} choices={teaser.choices} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {featuredId && !teaser && (
          <Link href={`/stories/${featuredId}?welcome=1`}>
            <Button className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300">
              <BookOpen className="h-4 w-4" />
              Jump right in
            </Button>
          </Link>
        )}
        <Link href="/stories/new?assist=1">
          <Button
            variant="ghost"
            className={
              featuredId
                ? 'gap-2 border border-white/10 text-muted-foreground/75 hover:text-foreground'
                : 'gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300'
            }
          >
            <Plus className="h-4 w-4" />
            Start writing in 60 seconds
          </Button>
        </Link>
        <Link href="/worlds/new">
          <Button variant="ghost" className="gap-2 text-muted-foreground/60 hover:text-foreground">
            <Sparkles className="h-4 w-4" />
            Create a world
          </Button>
        </Link>
      </div>
    </div>
  )
}

function HeroActionsFallback() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/stories/new">
        <Button className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300">
          <Plus className="h-4 w-4" />
          Start a story
        </Button>
      </Link>
      <Link href="/worlds/new">
        <Button variant="ghost" className="gap-2 text-muted-foreground/60 hover:text-foreground">
          <Sparkles className="h-4 w-4" />
          Create a world
        </Button>
      </Link>
    </div>
  )
}

const HOW_IT_WORKS = [
  { icon: BookOpen, title: 'Read', body: 'Open any book and read a chapter — no account needed.' },
  { icon: PenLine, title: 'Choose your way', body: 'Follow a path others wrote — or write where you go next, and the AI brings your chapter to life.' },
  { icon: MousePointerClick, title: 'Leave a trail', body: 'Every path you write becomes one the next reader can take. The world grows with you.' },
]

function HowItWorks() {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {HOW_IT_WORKS.map((step, i) => (
        <div
          key={step.title}
          className="glass-card rounded-xl p-5 border border-white/[0.07] flex items-start gap-3"
        >
          <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300">
            <step.icon className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground/55">
                Step {i + 1}
              </span>
              <span className="text-sm font-semibold text-foreground/85">{step.title}</span>
            </div>
            <p className="text-xs text-muted-foreground/55 leading-relaxed">{step.body}</p>
          </div>
        </div>
      ))}
    </section>
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
        <Suspense fallback={<HeroActionsFallback />}>
          <HeroActions />
        </Suspense>
      </section>

      <HowItWorks />

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
