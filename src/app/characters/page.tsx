import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, Globe } from 'lucide-react'
import { listCharacters } from '@/lib/firestore-helpers'
import { appearanceSummary, isCrossWorld } from '@/lib/characters'
import { CharacterPortrait } from '@/components/character/CharacterPortrait'

export const metadata: Metadata = {
  title: 'Characters',
  description: 'The cast of Chronicle — collectible characters who appear across stories and worlds.',
  alternates: { canonical: '/characters' },
}

export const dynamic = 'force-dynamic'

export default async function CharactersPage() {
  const characters = await listCharacters(60)

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-amber-400/70 text-xs uppercase tracking-widest font-sans">
          <Users className="h-3.5 w-3.5" />
          The cast
        </div>
        <h1 className="text-3xl font-bold gold-text">Characters</h1>
        <p className="text-sm text-muted-foreground/60 max-w-2xl">
          Heroes and canon figures who appear across Chronicle&apos;s stories. The more a character is written, the
          further they travel — some cross from one world into another.
        </p>
      </header>

      {characters.length === 0 ? (
        <p className="text-sm text-muted-foreground/50">
          No characters yet. Give a story a named protagonist and they&apos;ll appear here.
        </p>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((c) => (
            <li key={c.id}>
              <Link
                href={`/characters/${c.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 hover:border-amber-500/30 hover:bg-white/[0.04] transition-colors h-full"
              >
                <CharacterPortrait name={c.name} portraitUrl={c.portraitUrl} size={64} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground/90 truncate group-hover:text-amber-200 transition-colors">
                    {c.name}
                  </div>
                  {c.tagline && <div className="text-xs text-muted-foreground/55 truncate">{c.tagline}</div>}
                  <div className="text-[11px] text-muted-foreground/45 mt-1 flex items-center gap-1.5">
                    {isCrossWorld(c) && <Globe className="h-3 w-3 text-teal-400/70" />}
                    {appearanceSummary(c)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
