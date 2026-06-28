import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Globe, BookOpen } from 'lucide-react'
import { getCharacter } from '@/lib/firestore-helpers'
import { appearanceSummary, isCrossWorld } from '@/lib/characters'
import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { ShareImageButton } from '@/components/share/ShareImageButton'

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

export const dynamic = 'force-dynamic'

export default async function CharacterPage({ params }: Props) {
  const { id } = await params
  const c = await getCharacter(id).catch(() => null)
  if (!c) notFound()

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
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
