'use client'

import { useState, useMemo, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Library, BookOpen } from 'lucide-react'
import { StoryCard } from '@/components/StoryCard'
import type { Story } from '@/types'

interface Props {
  stories: Story[]
}

export function LibraryClient({ stories }: Props) {
  const searchId = useId()
  const [search, setSearch] = useState('')
  const [worldFilter, setWorldFilter] = useState<string | null>(null)

  // Unique world names, sorted A→Z
  const worlds = useMemo(() => {
    const names = [...new Set(stories.map((s) => s.worldName))]
    return names.sort((a, b) => a.localeCompare(b))
  }, [stories])

  // Filter and group into alphabetised shelves
  const shelves = useMemo(() => {
    const q = search.trim().toLowerCase()

    let pool = stories
    if (q) {
      pool = pool.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.authorName.toLowerCase().includes(q),
      )
    }
    if (worldFilter) {
      pool = pool.filter((s) => s.worldName === worldFilter)
    }

    // Group by world
    const map = new Map<string, Story[]>()
    for (const story of pool) {
      if (!map.has(story.worldName)) map.set(story.worldName, [])
      map.get(story.worldName)!.push(story)
    }

    // Sort stories within each world A→Z, then sort worlds A→Z
    for (const list of map.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title))
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [stories, search, worldFilter])

  const totalVisible = shelves.reduce((n, [, books]) => n + books.length, 0)
  const isFiltered = search.trim() !== '' || worldFilter !== null

  function clearFilters() {
    setSearch('')
    setWorldFilter(null)
  }

  return (
    <div className="space-y-10">
      {/* ── Card-catalog search ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-lg">
          <label htmlFor={searchId} className="sr-only">
            Search stories
          </label>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400/35 pointer-events-none" />
          <input
            id={searchId}
            type="search"
            placeholder="Search by title or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full h-11 pl-10 pr-10 rounded-lg text-sm
              border border-white/10 bg-white/[0.04]
              text-foreground placeholder:text-muted-foreground/30
              focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-amber-500/25
              transition-colors font-sans
            "
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isFiltered && (
          <button
            onClick={clearFilters}
            className="text-xs font-sans text-amber-400/50 hover:text-amber-400 transition-colors whitespace-nowrap self-center"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── World filter pills ── */}
      {worlds.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by world">
          <WorldPill
            label="All worlds"
            active={worldFilter === null}
            onClick={() => setWorldFilter(null)}
          />
          {worlds.map((world) => (
            <WorldPill
              key={world}
              label={world}
              active={worldFilter === world}
              onClick={() => setWorldFilter(worldFilter === world ? null : world)}
            />
          ))}
        </div>
      )}

      {/* ── Shelves ── */}
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
                <WorldShelf worldName={worldName} books={books} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Footer count ── */}
      {totalVisible > 0 && (
        <p className="text-[11px] text-muted-foreground/20 font-sans text-center pb-4">
          {totalVisible} {totalVisible === 1 ? 'story' : 'stories'} across{' '}
          {shelves.length} {shelves.length === 1 ? 'world' : 'worlds'}
        </p>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WorldPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`
        px-3 py-1 rounded-full text-xs font-sans transition-all border
        ${
          active
            ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
            : 'border-white/10 text-muted-foreground/45 hover:border-white/20 hover:text-muted-foreground/70'
        }
      `}
    >
      {label}
    </button>
  )
}

function WorldShelf({ worldName, books }: { worldName: string; books: Story[] }) {
  return (
    <section aria-label={`${worldName} — ${books.length} ${books.length === 1 ? 'story' : 'stories'}`}>
      {/* Section label — like a library placard */}
      <div className="flex items-baseline gap-4 mb-7">
        <div className="flex items-center gap-2.5">
          {/* Decorative placard pin */}
          <span className="text-amber-500/25 text-xs">§</span>
          <h2
            className="text-[17px] font-semibold text-foreground/65 tracking-tight"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {worldName}
          </h2>
        </div>
        <span className="text-[10px] font-sans text-muted-foreground/25 uppercase tracking-widest shrink-0">
          {books.length} {books.length === 1 ? 'story' : 'stories'}
        </span>
        {/* Rule */}
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, oklch(1 0 0 / 7%), transparent)' }} />
      </div>

      {/* Books + physical shelf */}
      <div className="relative">
        {/* Book grid — portrait 2:3 aspect, A→Z left to right */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 sm:gap-5 pb-6">
          {books.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>

        {/* ── Shelf board ── */}
        <ShelfBoard />
      </div>
    </section>
  )
}

function ShelfBoard() {
  return (
    <div className="relative h-5 -mx-1">
      {/* Main plank */}
      <div
        className="absolute inset-0 rounded-[3px]"
        style={{
          background:
            'linear-gradient(to bottom, oklch(0.33 0.065 53), oklch(0.27 0.055 51) 45%, oklch(0.23 0.045 49))',
          boxShadow:
            '0 5px 14px -2px rgba(0,0,0,0.60), inset 0 1px 0 oklch(1 0 0 / 9%), inset 0 -1px 0 oklch(0 0 0 / 35%)',
        }}
      />
      {/* Grain highlight strip */}
      <div
        className="absolute top-px inset-x-0 h-px rounded opacity-30"
        style={{
          background:
            'linear-gradient(to right, transparent, oklch(1 0 0 / 35%) 30%, oklch(1 0 0 / 20%) 70%, transparent)',
        }}
      />
      {/* Front-edge bevel */}
      <div
        className="absolute bottom-0 inset-x-0 h-1 rounded-b-[3px] opacity-55"
        style={{
          background:
            'linear-gradient(to right, transparent, oklch(0.55 0.10 63 / 55%) 25%, oklch(0.60 0.11 66 / 60%) 50%, oklch(0.55 0.10 63 / 55%) 75%, transparent)',
        }}
      />
      {/* Cast shadow on floor */}
      <div
        className="absolute top-full inset-x-6 h-7 blur-2xl opacity-45 pointer-events-none"
        style={{ background: 'oklch(0.08 0.03 50)' }}
      />
    </div>
  )
}

function EmptyState({
  isFiltered,
  onClear,
}: {
  isFiltered: boolean
  onClear: () => void
}) {
  return (
    <div className="text-center py-24 space-y-3">
      <div className="w-14 h-14 rounded-2xl glass-card border border-amber-500/15 flex items-center justify-center mx-auto">
        {isFiltered ? (
          <Search className="h-6 w-6 text-amber-400/30" />
        ) : (
          <BookOpen className="h-6 w-6 text-amber-400/30" />
        )}
      </div>
      <p className="text-muted-foreground/50 text-sm">
        {isFiltered ? 'No stories match your search.' : 'The library is empty.'}
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
