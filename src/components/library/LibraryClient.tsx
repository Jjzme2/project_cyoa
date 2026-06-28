'use client'

import { useState, useMemo, useId } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Library, BookOpen, Tag, ChevronDown } from 'lucide-react'
import { StoryCard } from '@/components/StoryCard'
import { WorldPortal } from '@/components/world/WorldPortal'
import { useAuth } from '@/components/Providers'
import { ratingRank } from '@/lib/ratings'
import type { Story, WorldTheme } from '@/types'

/** A world's display identity, keyed by world name, used to head its shelf. */
export interface WorldChrome {
  theme?: WorldTheme
  tone?: string
}

interface Props {
  stories: Story[]
  worldChrome?: Record<string, WorldChrome>
}

export function LibraryClient({ stories, worldChrome = {} }: Props) {
  const searchId = useId()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const { allowedRank } = useAuth()
  const [search, setSearch] = useState('')
  // The URL is the single source of truth for the world filter, so it stays
  // correct across back/forward navigation without a state mirror to sync.
  const worldFilter = searchParams.get('world')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // Age gate: never surface stories rated above what this viewer may see.
  const visibleStories = useMemo(
    () => stories.filter((s) => ratingRank(s.rating) <= allowedRank),
    [stories, allowedRank],
  )

  function setWorld(world: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (world) {
      params.set('world', world)
    } else {
      params.delete('world')
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Worlds with story counts, sorted by count desc then name
  const worlds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of visibleStories) counts.set(s.worldName, (counts.get(s.worldName) ?? 0) + 1)
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [visibleStories])

  // Unique tags across all stories
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of visibleStories) {
      if (s.tags) s.tags.forEach((t) => tagSet.add(t))
    }
    return [...tagSet].sort()
  }, [visibleStories])

  // Filter and group into shelves
  const shelves = useMemo(() => {
    const q = search.trim().toLowerCase()
    let pool = visibleStories
    if (q) {
      pool = pool.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.authorName.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q),
      )
    }
    if (worldFilter) pool = pool.filter((s) => s.worldName === worldFilter)
    if (tagFilter) pool = pool.filter((s) => s.tags?.includes(tagFilter))

    const map = new Map<string, Story[]>()
    for (const story of pool) {
      if (!map.has(story.worldName)) map.set(story.worldName, [])
      map.get(story.worldName)!.push(story)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title))
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [visibleStories, search, worldFilter, tagFilter])

  const totalVisible = shelves.reduce((n, [, books]) => n + books.length, 0)
  const isFiltered = search.trim() !== '' || worldFilter !== null || tagFilter !== null

  function clearFilters() {
    setSearch('')
    setWorld(null)
    setTagFilter(null)
  }

  return (
    <div className="space-y-7">
      {/* ── Filter bar: search + world select ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">Search stories</label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/35 pointer-events-none" />
          <input
            id={searchId}
            type="search"
            placeholder="Search by title, author, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-10 rounded-lg text-sm border border-white/10 bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/25 transition-colors font-sans"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* World selector */}
        {worlds.length > 1 && (
          <div className="relative shrink-0">
            <Library className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400/35 pointer-events-none" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <select
              value={worldFilter ?? ''}
              onChange={(e) => setWorld(e.target.value || null)}
              aria-label="Filter by world"
              className="h-10 pl-8 pr-8 rounded-lg text-sm border border-white/10 bg-white/[0.04] text-foreground/70 focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/25 transition-colors font-sans appearance-none cursor-pointer min-w-[180px]"
            >
              <option value="">All worlds ({visibleStories.length})</option>
              {worlds.map(({ name, count }) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          </div>
        )}

        {isFiltered && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-sans text-amber-400/50 hover:text-amber-400 transition-colors whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Genre chips (reader favorites) ── */}
      {allTags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/45 font-sans font-semibold flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> Genres
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by genre">
            {allTags.map((tag) => (
              <FilterPill
                key={tag}
                label={tag}
                active={tagFilter === tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                variant="tag"
              />
            ))}
          </div>
        </div>
      )}

      {/* Shelves */}
      {shelves.length === 0 ? (
        <EmptyState isFiltered={isFiltered} onClear={clearFilters} />
      ) : (
        <div className="space-y-16">
          <AnimatePresence initial={false}>
            {shelves.map(([worldName, books]) => (
              <motion.div
                key={worldName}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <WorldShelf worldName={worldName} books={books} chrome={worldChrome[worldName]} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {totalVisible > 0 && (
        <p className="text-[11px] text-muted-foreground/45 font-sans text-center pb-4">
          {totalVisible} {totalVisible === 1 ? 'story' : 'stories'} across{' '}
          {shelves.length} {shelves.length === 1 ? 'world' : 'worlds'}
        </p>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
  variant = 'world',
}: {
  label: string
  active: boolean
  onClick: () => void
  variant?: 'world' | 'tag'
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded-full text-xs font-sans transition-all border ${
        active
          ? variant === 'tag'
            ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
            : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
          : 'border-white/10 text-muted-foreground/45 hover:border-white/20 hover:text-muted-foreground/70'
      }`}
    >
      {label}
    </button>
  )
}

function WorldShelf({
  worldName,
  books,
  chrome,
}: {
  worldName: string
  books: Story[]
  chrome?: WorldChrome
}) {
  const storyCount = `${books.length} ${books.length === 1 ? 'story' : 'stories'}`
  return (
    <section aria-label={`${worldName} — ${storyCount}`}>
      {chrome?.theme ? (
        // Worlds with a designed identity head their shelf with their banner.
        <div className="mb-7 space-y-2">
          <WorldPortal
            theme={chrome.theme}
            name={worldName}
            tagline={chrome.tone}
            variant="card"
            animate={false}
          />
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-sans text-muted-foreground/45 uppercase tracking-widest shrink-0">
              {storyCount}
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: 'linear-gradient(to right, oklch(1 0 0 / 7%), transparent)' }}
            />
          </div>
        </div>
      ) : (
        // Fallback: a plain text header for worlds without a theme.
        <div className="flex items-baseline gap-4 mb-7">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-500/25 text-xs">§</span>
            <h2
              className="text-[17px] font-semibold text-foreground/65 tracking-tight"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {worldName}
            </h2>
          </div>
          <span className="text-[10px] font-sans text-muted-foreground/45 uppercase tracking-widest shrink-0">
            {storyCount}
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: 'linear-gradient(to right, oklch(1 0 0 / 7%), transparent)' }}
          />
        </div>
      )}

      <div className="relative">
        <div className="flex flex-wrap gap-2.5 pb-6">
          {books.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
        <ShelfBoard />
      </div>
    </section>
  )
}

function ShelfBoard() {
  return (
    <div className="relative h-5 -mx-1">
      <div
        className="absolute inset-0 rounded-[3px]"
        style={{
          background: 'linear-gradient(to bottom, oklch(0.33 0.065 53), oklch(0.27 0.055 51) 45%, oklch(0.23 0.045 49))',
          boxShadow: '0 5px 14px -2px rgba(0,0,0,0.60), inset 0 1px 0 oklch(1 0 0 / 9%), inset 0 -1px 0 oklch(0 0 0 / 35%)',
        }}
      />
      <div
        className="absolute top-px inset-x-0 h-px rounded opacity-30"
        style={{ background: 'linear-gradient(to right, transparent, oklch(1 0 0 / 35%) 30%, oklch(1 0 0 / 20%) 70%, transparent)' }}
      />
      <div
        className="absolute bottom-0 inset-x-0 h-1 rounded-b-[3px] opacity-55"
        style={{ background: 'linear-gradient(to right, transparent, oklch(0.55 0.10 63 / 55%) 25%, oklch(0.60 0.11 66 / 60%) 50%, oklch(0.55 0.10 63 / 55%) 75%, transparent)' }}
      />
      <div
        className="absolute top-full inset-x-6 h-7 blur-2xl opacity-45 pointer-events-none"
        style={{ background: 'oklch(0.08 0.03 50)' }}
      />
    </div>
  )
}

function EmptyState({ isFiltered, onClear }: { isFiltered: boolean; onClear: () => void }) {
  return (
    <div className="text-center py-24 space-y-3">
      <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/15 flex items-center justify-center mx-auto">
        {isFiltered ? <Search className="h-6 w-6 text-amber-400/30" /> : <BookOpen className="h-6 w-6 text-amber-400/30" />}
      </div>
      <p className="text-muted-foreground/50 text-sm">
        {isFiltered ? 'No stories match your filters.' : 'The library is empty.'}
      </p>
      {isFiltered && (
        <button
          onClick={onClear}
          className="text-xs text-amber-400/50 hover:text-amber-400 transition-colors underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
