import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Globe, BookOpen } from 'lucide-react'
import { getCharacter } from '@/lib/firestore-helpers'
import { appearanceSummary, isCrossWorld } from '@/lib/characters'
import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { GeneratePortraitButton } from '@/components/character/GeneratePortraitButton'
import { ShareImageButton } from '@/components/share/ShareImageButton'
import { APP_CONFIG } from '@/lib/config'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const c = await getCharacter(id).catch(() => null)
  if (!c) return { title: 'Character not found' }
  return {
    title: c.name,
    description: c.description || c.tagline || appearanceSummary(c),
    alternates: { canonical: `/characters/${id}` },
  }
}

async function CharacterDetail({ params }: Props) {
  const { id } = await params
  const c = await getCharacter(id).catch(() => null)
  if (!c) notFound()

  // Structured data so a character can surface as a rich result / entity.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: c.name,
    url: `${APP_CONFIG.site.url}/characters/${c.id}`,
    ...(c.tagline ? { description: c.tagline } : c.description ? { description: c.description } : {}),
    ...(c.portraitUrl ? { image: c.portraitUrl } : {}),
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link
        href="/characters"
        className="inline-flex items-center gap-1.5 text-xs text-amber-400/50 hover:text-amber-400 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All characters
      </Link>

      <header className="flex items-start gap-5">
        <CharacterPortrait name={c.name} portraitUrl={c.portraitUrl} size={104} className="shrink-0" rounded="rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="text-3xl font-bold text-foreground/90">{c.name}</h1>
          {c.tagline && (
            <p className="text-muted-foreground/70 italic" style={{ fontFamily: 'Georgia, serif' }}>
              {c.tagline}
            </p>
          )}
          <div className="text-xs text-muted-foreground/50 flex items-center gap-1.5">
            {isCrossWorld(c) && <Globe className="h-3.5 w-3.5 text-teal-400/70" />}
            {appearanceSummary(c)}
          </div>
        </div>
      </header>

      {c.description && (
        <p className="text-[15px] leading-relaxed text-foreground/80" style={{ fontFamily: 'Georgia, serif' }}>
          {c.description}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <ShareImageButton
          cardUrl={`/api/share-card/character/${c.id}`}
          filename={`chronicle-character-${c.id}`}
          shareTitle={c.name}
          label="Share character"
        />
        <GeneratePortraitButton
          characterId={c.id}
          scope={c.scope}
          ownerId={c.ownerId}
          hasPortrait={Boolean(c.portraitUrl)}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground/50 font-sans">Appearances</h2>
        <ul className="space-y-2">
          {c.appearances.map((a) => (
            <li key={a.storyId}>
              <Link
                href={`/stories/${a.storyId}`}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 hover:border-amber-500/30 hover:bg-white/[0.04] transition-colors"
              >
                <BookOpen className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground/85 truncate group-hover:text-amber-200 transition-colors">
                    {a.storyTitle}
                  </div>
                  <div className="text-[11px] text-muted-foreground/45 truncate">{a.worldName}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

function CharacterSkeleton() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="h-3 w-28 rounded bg-white/5 shimmer" />
      <div className="flex items-start gap-5">
        <div className="h-26 w-26 rounded-2xl bg-white/5 shimmer" style={{ width: 104, height: 104 }} />
        <div className="flex-1 space-y-2 pt-2">
          <div className="h-8 w-1/2 rounded bg-white/5 shimmer" />
          <div className="h-4 w-1/3 rounded bg-white/5 shimmer" />
        </div>
      </div>
    </main>
  )
}

export default function CharacterPage({ params }: Props) {
  return (
    <Suspense fallback={<CharacterSkeleton />}>
      <CharacterDetail params={params} />
    </Suspense>
  )
}
