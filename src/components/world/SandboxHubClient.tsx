'use client'

import { useMemo, useState, useId } from 'react'
import Link from 'next/link'
import { Search, X, FlaskConical } from 'lucide-react'
import { CONTENT_RATING_META } from '@/types'
import { resolveNarrativeMode } from '@/lib/engine/narrative-mode'
import { WorldPortal } from '@/components/world/WorldPortal'
import { themeForTone, DEFAULT_WORLD_THEME } from '@/components/world/world-theme'
import type { World } from '@/types'

function SandboxCard({ world }: { world: World }) {
  const theme = world.theme ?? themeForTone(world.tone, DEFAULT_WORLD_THEME)
  return (
    <Link
      href={`/worlds/${world.id}/sandbox`}
      className="glass-card rounded-xl overflow-hidden flex flex-col justify-between group hover:border-white/15 transition-colors border border-white/[0.07]"
    >
      <WorldPortal theme={theme} variant="card" animate={false} className="rounded-none" />
      <div className="px-5 pt-5 pb-4 space-y-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2
            className="text-lg font-semibold leading-snug text-foreground/90 group-hover:text-amber-200 transition-colors"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {world.name}
          </h2>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {resolveNarrativeMode(world) === 'gentle' && (
              <span
                className="text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/10 border-emerald-500/25"
                title="A gentle world — nothing bad happens here"
              >
                🌿 Gentle
              </span>
            )}
            {world.rating && (
              <span
                className={`text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded-full border ${CONTENT_RATING_META[world.rating].className}`}
                title={world.rating}
              >
                {CONTENT_RATING_META[world.rating].abbr}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground/60 leading-relaxed line-clamp-2">{world.description}</p>
      </div>
      <div className="flex items-center justify-between mx-5 mb-5 pt-3 border-t border-white/[0.06]">
        <span className="text-xs text-muted-foreground/45 font-sans">{world.tone}</span>
        <span className="text-xs font-sans font-medium text-amber-300/70 group-hover:text-amber-300 transition-colors flex items-center gap-1">
          <FlaskConical className="h-3 w-3" />
          Enter sandbox
        </span>
      </div>
    </Link>
  )
}

export function SandboxHubClient({ worlds }: { worlds: World[] }) {
  const searchId = useId()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return worlds
    return worlds.filter(
      (w) => w.name.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) || w.tone.toLowerCase().includes(q),
    )
  }, [worlds, search])

  return (
    <div className="space-y-7">
      <div className="relative max-w-md">
        <label htmlFor={searchId} className="sr-only">Search worlds to sandbox</label>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/35 pointer-events-none" />
        <input
          id={searchId}
          type="search"
          placeholder="Search worlds…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-10 rounded-lg text-sm border border-white/10 bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/25 transition-colors font-sans"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24 space-y-3">
          <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/15 flex items-center justify-center mx-auto">
            <Search className="h-6 w-6 text-amber-400/30" />
          </div>
          <p className="text-muted-foreground/50 text-sm">No worlds match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((world) => (
            <SandboxCard key={world.id} world={world} />
          ))}
        </div>
      )}
    </div>
  )
}
