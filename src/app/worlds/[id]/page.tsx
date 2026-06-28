import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Feather, BookOpen, Plus, ArrowLeft, ScrollText, Map } from 'lucide-react'
import { WorldMap } from '@/components/world/WorldMap'
import { Button } from '@/components/ui/button'
import { AgeFilteredStoryGrid } from '@/components/library/AgeFilteredStoryGrid'
import { SeededBadge } from '@/components/ContentBadges'
import { WorldRatingControl } from '@/components/world/WorldRatingControl'
import { WorldLore } from '@/components/world/WorldLore'
import { WorldGenesis } from '@/components/world/WorldGenesis'
import { GenerateGenesisButton } from '@/components/world/GenerateGenesisButton'
import { OutsiderRegard } from '@/components/world/OutsiderRegard'
import { MultiverseSettings } from '@/components/world/MultiverseSettings'
import { WorldPortal } from '@/components/world/WorldPortal'
import { ShareImageButton } from '@/components/share/ShareImageButton'
import { themeForTone, DEFAULT_WORLD_THEME } from '@/components/world/world-theme'
import { getWorld, getStoriesByWorld, getWorldChronicle, getWorldLegends, getWorldOutsiderRegard, getCharactersByWorld } from '@/lib/firestore-helpers'
import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { isCrossWorld } from '@/lib/characters'
import { APP_CONFIG } from '@/lib/config'

interface Props {
  params: Promise<{ id: string }>
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const world = await getWorld(id).catch(() => null)
  if (!world) return { title: 'World not found' }

  const title = world.name
  const description =
    world.description || `Explore ${world.name} — a community CYOA world on ${APP_CONFIG.site.name}.`

  return {
    title,
    description,
    alternates: { canonical: `/worlds/${id}` },
    openGraph: { title, description, type: 'website', siteName: APP_CONFIG.site.name, url: `/worlds/${id}` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

async function WorldDetail({ params }: { params: Promise<{ id: string }> }) {
  // Resolve dynamic params inside the Suspense boundary (Cache Components rule).
  // The underlying reads are individually cached via their own `use cache`.
  const { id } = await params
  const world = await getWorld(id).catch(() => null)
  if (!world) notFound()

  const [stories, chronicle, legends, outsiders, cast] = await Promise.all([
    getStoriesByWorld(id).catch(() => []),
    getWorldChronicle(id).catch(() => []),
    getWorldLegends(id).catch(() => ({ revered: [], reviled: [] })),
    getWorldOutsiderRegard(id).catch(() => null),
    getCharactersByWorld(id).catch(() => []),
  ])
  const toneClass = TONE_COLORS[world.tone] ?? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  // Legacy worlds (no saved theme) get a coherent look derived from their tone.
  const theme = world.theme ?? themeForTone(world.tone, DEFAULT_WORLD_THEME)

  return (
    <>
      <section className="space-y-6">
        <Link
          href="/worlds"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-foreground transition-colors font-sans"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All worlds
        </Link>

        <WorldPortal theme={theme} variant="banner" />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight gold-text"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {world.name}
            </h1>
            <span className={`shrink-0 text-[11px] uppercase tracking-wider font-semibold font-sans px-2.5 py-1 rounded-full border ${toneClass}`}>
              {world.tone}
            </span>
          </div>

          {world.description && (
            <p className="text-muted-foreground/70 max-w-2xl leading-relaxed">{world.description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground/45 font-sans">
            <span className="flex items-center gap-1.5">
              <Feather className="h-3.5 w-3.5" />
              {world.authorName}
            </span>
            <span className="flex items-center gap-1.5 text-amber-400/60">
              <BookOpen className="h-3.5 w-3.5" />
              {stories.length} {stories.length === 1 ? 'story' : 'stories'}
            </span>
            <WorldRatingControl worldId={world.id} authorId={world.authorId} rating={world.rating} />
            {world.seeded && <SeededBadge />}
          </div>

          {world.tags && world.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {world.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-sans uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 text-muted-foreground/45">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {world.lore && (
          <div className="glass-card rounded-xl p-5 border border-white/[0.07] space-y-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-400/50 font-sans">
              <ScrollText className="h-3.5 w-3.5" />
              Lore
            </div>
            <p className="text-sm text-muted-foreground/60 leading-relaxed italic">{world.lore}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1 flex-wrap items-center">
          <Link href={`/stories/new?world=${encodeURIComponent(world.id)}`}>
            <Button className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300">
              <Plus className="h-4 w-4" />
              Start a story here
            </Button>
          </Link>
          <ShareImageButton
            cardUrl={`/api/share-card/world/${world.id}`}
            filename={`chronicle-world-${world.id}`}
            shareTitle={world.name}
            label="Share this world"
          />
        </div>
      </section>

      <div className="border-t border-white/[0.07]" />

      <section className="space-y-7">
        <div className="flex items-center gap-4">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground/50 font-sans">
            Stories in this world
          </h2>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {world.genesis?.regions && world.genesis.regions.length > 0 && (
          <div className="glass-card rounded-xl p-6 space-y-3 border border-white/[0.07]">
            <h2 className="text-sm font-medium text-foreground/65 flex items-center gap-2">
              <Map className="h-4 w-4 text-amber-400/55" /> World Map
            </h2>
            <div className="rounded-lg bg-black/20 border border-white/[0.05] overflow-hidden">
              <WorldMap bible={world.genesis} seed={world.seed ?? 0} className="w-full aspect-[4/3]" />
            </div>
            <p className="text-[11px] text-muted-foreground/45">
              The realm&apos;s regions, with bonds (gold) and rivalries (red) between the powers that hold them.
            </p>
          </div>
        )}

        {world.genesis ? (
          <WorldGenesis genesis={world.genesis} />
        ) : (
          <GenerateGenesisButton worldId={world.id} authorId={world.authorId} />
        )}

        {outsiders && <OutsiderRegard regard={outsiders} />}

        <MultiverseSettings
          worldId={world.id}
          authorId={world.authorId}
          initialMultiverseName={world.multiverse?.name ?? ''}
          initialLinks={world.links ?? []}
        />

        <WorldLore chronicle={chronicle} legends={legends} />

        {stories.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-muted-foreground/50 text-sm">No stories have been written here yet.</p>
            <Link
              href={`/stories/new?world=${encodeURIComponent(world.id)}`}
              className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors underline underline-offset-2"
            >
              Write the first chapter
            </Link>
          </div>
        ) : (
          <AgeFilteredStoryGrid stories={stories} />
        )}

        {cast.length > 0 && (
          <div className="space-y-3 pt-2">
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground/50 font-sans">Cast</h2>
            <ul className="flex flex-wrap gap-3">
              {cast.slice(0, 12).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/characters/${c.id}`}
                    className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] pr-3.5 hover:border-amber-500/30 hover:bg-white/[0.04] transition-colors"
                  >
                    <CharacterPortrait name={c.name} portraitUrl={c.portraitUrl} size={40} rounded="rounded-l-xl rounded-r-none" />
                    <div className="py-1.5 min-w-0">
                      <div className="text-sm text-foreground/85 truncate group-hover:text-amber-200 transition-colors flex items-center gap-1.5">
                        {c.name}
                        {isCrossWorld(c) && <Map className="h-3 w-3 text-teal-400/70" />}
                      </div>
                      {c.tagline && <div className="text-[11px] text-muted-foreground/45 truncate">{c.tagline}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  )
}

function WorldDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-3 w-24 rounded bg-white/5 shimmer" />
      <div className="h-12 w-2/3 rounded bg-white/5 shimmer" />
      <div className="h-4 w-full max-w-2xl rounded bg-white/5 shimmer" />
      <div className="h-4 w-1/3 rounded bg-white/5 shimmer" />
    </div>
  )
}

export default function WorldPage({ params }: Props) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <Suspense fallback={<WorldDetailSkeleton />}>
        <WorldDetail params={params} />
      </Suspense>
    </main>
  )
}
