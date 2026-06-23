'use client'

import { useState, useMemo, useId } from 'react'
import Link from 'next/link'
import { Search, X, Globe, BookOpen, Feather, SlidersHorizontal } from 'lucide-react'
import { CONTENT_RATING_META } from '@/types'
import { SeededBadge } from '@/components/ContentBadges'
import { truncateAtWord } from '@/lib/utils'
import type { World } from '@/types'

// ── Tone color map (mirrors worlds/page.tsx server copy) ──────────────────────

const TONE_COLORS: Record<string, string> = {
  'Epic Fantasy':          'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'Dark Fantasy':          'text-violet-300 bg-violet-900/20 border-violet-700/25',
  'Dark Horror':           'text-red-400 bg-red-500/10 border-red-500/20',
  'Gothic Horror':         'text-rose-300 bg-rose-900/20 border-rose-700/25',
  'Cosmic Horror':         'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'Supernatural Thriller': 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  'Sci-Fi Adventure':      'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'Space Opera':           'text-sky-400 bg-sky-500/10 border-sky-500/20',
  'Cyberpunk Dystopia':    'text-teal-300 bg-teal-900/20 border-teal-600/25',
  'Solarpunk':             'text-lime-400 bg-lime-500/10 border-lime-500/20',
  'Cozy Mystery':          'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'Gritty Noir':           'text-stone-400 bg-stone-500/10 border-stone-500/20',
  'Political Intrigue':    'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'High Drama':            'text-pink-400 bg-pink-500/10 border-pink-500/20',
  'Romantic Drama':        'text-rose-400 bg-rose-500/10 border-rose-500/20',
  'Slice of Life':         'text-green-400 bg-green-500/10 border-green-500/20',
  'Whimsical Fairy Tale':  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Mythological Epic':     'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  'Post-Apocalyptic':      'text-orange-300 bg-orange-900/20 border-orange-700/25',
  'Survival Horror':       'text-red-300 bg-red-900/20 border-red-700/25',
  'LitRPG':                'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  'Steampunk Adventure':   'text-amber-300 bg-amber-900/20 border-amber-700/25',
}

// ── Sort options ──────────────────────────────────────────────────────────────

type SortKey = 'stories' | 'name' | 'newest'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'stories', label: 'Most stories' },
  { id: 'name',    label: 'A → Z'        },
  { id: 'newest',  label: 'Newest'       },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface WorldWithCount extends World {
  storyCount: number
}

interface Props {
  worlds: WorldWithCount[]
}

// ── WorldCard (client copy) ───────────────────────────────────────────────────

function WorldCard({ world }: { world: WorldWithCount }) {
  const toneClass = TONE_COLORS[world.tone] ?? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  return (
    <div className="glass-card rounded-xl p-5 space-y-3 flex flex-col justify-between group hover:border-white/15 transition-colors border border-white/[0.07]">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h2
            className="text-lg font-semibold leading-snug text-foreground/90 group-hover:text-amber-200 transition-colors"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <Link href={`/worlds/${world.id}`} className="hover:underline underline-offset-4 decoration-amber-400/40">
              {world.name}
            </Link>
          </h2>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
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

        <p className="text-sm text-muted-foreground/60 leading-relaxed line-clamp-2">
          {world.description}
        </p>

        {world.lore && (
          <p className="text-xs text-muted-foreground/55 leading-relaxed line-clamp-2 border-l-2 border-white/10 pl-3 italic">
            {truncateAtWord(world.lore, 140)}
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
          {world.storyCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400/60 font-sans">
              <BookOpen className="h-3 w-3" />
              <span>{world.storyCount} {world.storyCount === 1 ? 'story' : 'stories'}</span>
            </div>
          )}
        </div>
        <Link
          href={`/worlds/${world.id}`}
          className="text-xs font-sans font-medium text-amber-300/70 hover:text-amber-300 transition-colors flex items-center gap-1"
        >
          {world.storyCount > 0 ? 'Browse stories' : 'Enter world'}
          <span className="opacity-50">→</span>
        </Link>
      </div>
    </div>
  )
}

// ── WorldsClient ──────────────────────────────────────────────────────────────

export function WorldsClient({ worlds }: Props) {
  const searchId = useId()
  const [search, setSearch]       = useState('')
  const [toneFilter, setToneFilter] = useState<string | null>(null)
  const [sort, setSort]           = useState<SortKey>('stories')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // All tones that appear in this world list
  const tones = useMemo(() => {
    const set = new Set(worlds.map((w) => w.tone).filter(Boolean))
    return [...set].sort()
  }, [worlds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let pool = worlds
    if (q) {
      pool = pool.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.authorName.toLowerCase().includes(q) ||
          (w.lore ?? '').toLowerCase().includes(q),
      )
    }
    if (toneFilter) pool = pool.filter((w) => w.tone === toneFilter)

    return [...pool].sort((a, b) => {
      if (sort === 'name')    return a.name.localeCompare(b.name)
      if (sort === 'newest')  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      return b.storyCount - a.storyCount || a.name.localeCompare(b.name)
    })
  }, [worlds, search, toneFilter, sort])

  const isFiltered = search.trim() !== '' || toneFilter !== null

  function clearFilters() {
    setSearch('')
    setToneFilter(null)
  }

  return (
    <div className="space-y-7">
      {/* ── Filter bar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <label htmlFor={searchId} className="sr-only">Search worlds</label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/35 pointer-events-none" />
            <input
              id={searchId}
              type="search"
              placeholder="Search by name, description, lore…"
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

          <div className="flex items-center gap-2 shrink-0">
            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort worlds"
              className="h-10 px-3 rounded-lg text-sm border border-white/10 bg-white/[0.04] text-foreground/60 focus:outline-none focus:ring-1 focus:ring-amber-500/40 transition-colors font-sans appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>

            {/* Tone filter toggle */}
            {tones.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-pressed={filtersOpen}
                className={`h-10 px-3.5 rounded-lg text-sm border transition-all font-sans flex items-center gap-1.5 ${
                  filtersOpen || toneFilter
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'border-white/10 text-muted-foreground/50 hover:border-white/20'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tone</span>
                {toneFilter && <span className="text-[10px] opacity-70">1</span>}
              </button>
            )}

            {isFiltered && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-sans text-amber-400/50 hover:text-amber-400 transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tone chips — shown when filter panel is open */}
        {filtersOpen && tones.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Filter by tone">
            {tones.map((tone) => {
              const active = toneFilter === tone
              const colorClass = TONE_COLORS[tone] ?? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              return (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setToneFilter(active ? null : tone)}
                  aria-pressed={active}
                  className={`px-3 py-1 rounded-full text-xs font-sans transition-all border ${
                    active ? colorClass : 'border-white/10 text-muted-foreground/45 hover:border-white/20 hover:text-muted-foreground/70'
                  }`}
                >
                  {tone}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 space-y-3">
          <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/15 flex items-center justify-center mx-auto">
            {isFiltered ? <Search className="h-6 w-6 text-amber-400/30" /> : <Globe className="h-6 w-6 text-amber-400/30" />}
          </div>
          <p className="text-muted-foreground/50 text-sm">
            {isFiltered ? 'No worlds match your filters.' : 'No worlds have been forged yet.'}
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-amber-400/50 hover:text-amber-400 transition-colors underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((world) => (
            <WorldCard key={world.id} world={world} />
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground/45 font-sans">
        {filtered.length === worlds.length
          ? `${worlds.length} ${worlds.length === 1 ? 'world' : 'worlds'} in the Chronicle`
          : `${filtered.length} of ${worlds.length} worlds`}
      </p>
    </div>
  )
}
