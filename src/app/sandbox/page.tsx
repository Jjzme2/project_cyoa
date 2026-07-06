import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { FlaskConical, Globe } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { getPublicWorlds } from '@/lib/firestore-helpers'
import { APP_CONFIG } from '@/lib/config'
import { SandboxHubClient } from '@/components/world/SandboxHubClient'
import type { World } from '@/types'

export const metadata: Metadata = {
  title: 'Sandbox',
  description:
    'A hands-on, no-consequence playground for any world on Chronicle — tinker with factions and economies, or step in as a hero or the world\'s own unseen god.',
  alternates: { canonical: '/sandbox' },
  robots: { index: false }, // a toy surface, not content — not worth indexing
}

async function SandboxHubContent() {
  'use cache'
  cacheLife('minutes')
  cacheTag('worlds')

  let worlds: World[] = []
  try {
    worlds = await getPublicWorlds(60)
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

  return <SandboxHubClient worlds={worlds} />
}

function SandboxHubSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-6 space-y-4 border border-white/[0.07]">
          <div className="h-6 w-3/4 rounded bg-white/5 shimmer" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-white/5 shimmer" />
            <div className="h-3 w-2/3 rounded bg-white/5 shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SandboxHubPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <section className="py-4 space-y-4">
        <div className="flex items-center gap-2 text-amber-400/50 text-xs uppercase tracking-widest font-sans">
          <FlaskConical className="h-3.5 w-3.5" />
          Sandbox
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          <span className="gold-text">No chapters.</span>
          <br />
          <span className="text-foreground/75">No consequences. Just play.</span>
        </h1>
        <p className="text-muted-foreground/60 max-w-lg text-sm leading-relaxed">
          Pick any world below and tinker directly with its factions, economy, and tension — or step inside it as a
          hero of your own making, or as its unseen god. {APP_CONFIG.site.name} Sandbox is a separate, no-stakes way
          to play: nothing here is ever saved to a real story, and free-form tinkering never costs credits.
        </p>
      </section>

      <div className="border-t border-white/[0.07]" />

      <section>
        <Suspense fallback={<SandboxHubSkeleton />}>
          <SandboxHubContent />
        </Suspense>
      </section>
    </main>
  )
}
