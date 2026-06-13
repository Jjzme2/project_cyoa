import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { Globe, BookOpen, Feather, Sparkles } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { getPublicWorlds, getStoryCounts } from '@/lib/firestore-helpers'
import { truncateAtWord } from '@/lib/utils'
import { APP_CONFIG } from '@/lib/config'
import { SeededBadge } from '@/components/ContentBadges'
import { CONTENT_RATING_META } from '@/types'
import type { World } from '@/types'

export const metadata: Metadata = {
  title: 'Worlds',
  description:
    'Browse the registry of worlds on Chronicle — each a distinct universe with its own lore, tone, and rules. Pick one and start writing.',
  alternates: { canonical: '/worlds' },
  openGraph: {
    title: `Worlds — ${APP_CONFIG.site.name}`,
    description:
      'Browse the registry of worlds on Chronicle — each a distinct universe with its own lore, tone, and rules.',
    type: 'website',
    siteName: APP_CONFIG.site.name,
    url: '/worlds',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Worlds — ${APP_CONFIG.site.name}`,
    description: 'Browse the registry of worlds on Chronicle — distinct universes to read and write in.',
  },
}

const TONE_COLORS: Record<string, string> = {
  'Epic Fantasy':        'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'Dark Horror':         'text-red-400 bg-red-500/10 border-red-500/20',
  'Sci-Fi Adventure':    'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'Cozy Mystery':        'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'High Drama':          'text-pink-400 bg-pink-500/10 border-pink-500/20',
  'Cosmic Horror':       'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'Whimsical Fairy Tale':'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Gritty Noir':         'text-stone-400 bg-stone-500/10 border-stone-500/20',
}

function WorldCard({ world, storyCount }: { world: World; storyCount: number }) {
  const toneClass = TONE_COLORS[world.tone] ?? 'text-amber-400 bg-amber-500/10 border-amber-500/20'

  return (
    <div className="glass-card rounded-xl p-6 space-y-4 flex flex-col justify-between group hover:border-white/15 transition-colors border border-white/[0.07]">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2
            className="text-xl font-semibold leading-snug text-foreground/90 group-hover:text-amber-200 transition-colors"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <Link href={`/worlds/${world.id}`} className="hover:underline underline-offset-4 decoration-amber-400/40">
              {world.name}
            </Link>
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {world.rating && (
              <span
                className={`text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded-full border ${CONTENT_RATING_META[world.rating].className}`}
                title={`${world.rating} — ${CONTENT_RATING_META[world.rating].description}`}
              >
                {CONTENT_RATING_META[world.rating].abbr}
              </span>
            )}
            <span className={`text-[10px] uppercase tracking-wider font-semibold font-sans px-2 py-0.5 rounded-full border ${toneClass}`}>
              {world.tone}
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground/60 leading-relaxed line-clamp-3">
          {world.description}
        </p>

        {world.lore && (
          <p className="text-xs text-muted-foreground/35 leading-relaxed line-clamp-2 border-l-2 border-white/10 pl-3 italic">
            {truncateAtWord(world.lore, 160)}
          </p>
        )}

        {world.tags && world.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {world.tags.map((tag) => (
              <span key={tag} className="text-[9px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground/40">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/45 font-sans">
            <span className="flex items-center gap-1.5">
              <Feather className="h-3 w-3" />
              {world.authorName}
            </span>
            {world.seeded && <SeededBadge abbr />}
          </div>
          {storyCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400/60 font-sans">
              <BookOpen className="h-3 w-3" />
              <span>{storyCount} {storyCount === 1 ? 'story' : 'stories'}</span>
            </div>
          )}
        </div>

        <Link
          href={`/worlds/${world.id}`}
          className="text-xs font-sans font-medium text-amber-300/70 hover:text-amber-300 transition-colors flex items-center gap-1"
        >
          {storyCount > 0 ? 'Browse stories' : 'Enter world'}
          <span className="opacity-50">→</span>
        </Link>
      </div>
    </div>
  )
}

async function WorldsContent() {
  'use cache'
  cacheLife('minutes')
  cacheTag('worlds', 'stories')

  let worlds: (World & { storyCount: number })[] = []
  try {
    const [allWorlds, storyCounts] = await Promise.all([getPublicWorlds(100), getStoryCounts()])
    worlds = allWorlds
      .map((w) => ({ ...w, storyCount: storyCounts[w.id] ?? 0 }))
      .sort((a, b) => b.storyCount - a.storyCount)
  } catch {
    return (
      <p className="text-center py-20 text-muted-foreground/40 text-sm">
        Could not load worlds — check your Firebase configuration.
      </p>
    )
  }

  if (worlds.length === 0) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/15 flex items-center justify-center mx-auto">
          <Globe className="h-6 w-6 text-amber-400/30" />
        </div>
        <p className="text-muted-foreground/50 text-sm">No worlds have been forged yet.</p>
        <Link href="/worlds/new" className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors underline underline-offset-2">
          Create the first world
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {worlds.map((world) => (
          <WorldCard key={world.id} world={world} storyCount={world.storyCount} />
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground/20 font-sans">
        {worlds.length} {worlds.length === 1 ? 'world' : 'worlds'} in the Chronicle
      </p>
    </div>
  )
}

function WorldsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-6 space-y-4 border border-white/[0.07]">
          <div className="h-6 w-3/4 rounded bg-white/5 shimmer" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-white/5 shimmer" />
            <div className="h-3 w-2/3 rounded bg-white/5 shimmer" />
          </div>
          <div className="h-3 w-1/2 rounded bg-white/5 shimmer" />
        </div>
      ))}
    </div>
  )
}

export default function WorldsPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <section className="py-4 space-y-4">
        <div className="flex items-center gap-2 text-amber-400/50 text-xs uppercase tracking-widest font-sans">
          <Globe className="h-3.5 w-3.5" />
          World Registry
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          <span className="gold-text">Worlds to explore.</span>
          <br />
          <span className="text-foreground/75">Stories to inhabit.</span>
        </h1>
        <p className="text-muted-foreground/60 max-w-md text-sm leading-relaxed">
          Every story lives within a world. Browse the registry of worlds — each one a distinct
          universe with its own lore, tone, and rules.
        </p>
        <div className="flex gap-3">
          <Link
            href="/worlds/new"
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Forge a world
          </Link>
        </div>
      </section>

      <div className="border-t border-white/[0.07]" />

      <section>
        <Suspense fallback={<WorldsSkeleton />}>
          <WorldsContent />
        </Suspense>
      </section>
    </main>
  )
}
