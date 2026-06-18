import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { Globe, Sparkles } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { getPublicWorlds, getStoryCounts } from '@/lib/firestore-helpers'
import { APP_CONFIG } from '@/lib/config'
import { WorldsClient } from '@/components/library/WorldsClient'
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

  return <WorldsClient worlds={worlds} />
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
