import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FlaskConical } from 'lucide-react'
import { getWorld } from '@/lib/firestore-helpers'
import { resolveNarrativeMode } from '@/lib/engine/narrative-mode'
import { SeededRNG } from '@/lib/engine/seed-rng'
import { WorldSandbox } from '@/components/world/WorldSandbox'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const world = await getWorld(id).catch(() => null)
  if (!world) return { title: 'World not found' }
  return {
    title: `${world.name} — Sandbox`,
    description: `A hands-on playground for ${world.name}'s factions, economy, and tension — no chapters, no stakes.`,
    alternates: { canonical: `/worlds/${id}/sandbox` },
    robots: { index: false }, // a toy, not content — not worth indexing
  }
}

export default async function WorldSandboxPage({ params }: Props) {
  const { id } = await params
  const world = await getWorld(id).catch(() => null)
  if (!world) notFound()

  const mode = resolveNarrativeMode(world)
  // Worlds predating the procedural-seed field fall back to a stable hash of
  // their own id, so the sandbox is still deterministic per world.
  const worldSeed = world.seed ?? SeededRNG.hashString(world.id)

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-2">
        <Link
          href={`/worlds/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-foreground transition-colors font-sans"
        >
          <ArrowLeft className="h-3 w-3" /> Back to {world.name}
        </Link>
        <h1 className="text-2xl font-bold gold-text flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-amber-400/80" />
          {world.name} Sandbox
        </h1>
        <p className="text-sm text-muted-foreground/60 max-w-2xl">
          Play with the world&apos;s systems directly — no story, no AI, no consequences.
        </p>
      </div>

      <WorldSandbox
        worldId={world.id}
        worldName={world.name}
        worldSeed={worldSeed}
        genesisFactions={world.genesis?.factions ?? []}
        mode={mode}
      />
    </main>
  )
}
