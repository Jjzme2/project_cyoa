'use client'

import { Users, Trophy, Map as MapIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Story, WorldBible } from '@/types'
import { WorldMap } from '@/components/world/WorldMap'
import type { DiscoveredEnding } from './book-viewer-internals'

/** The world map, with the reader's current location highlighted + path so far. */
export function MapDialog({
  open,
  onOpenChange,
  genesis,
  seed,
  currentLocation,
  visited,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  genesis?: WorldBible
  seed?: number
  currentLocation?: string | null
  visited?: string[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/15 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="gold-text text-lg flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-amber-400" />
            World map
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-black/30 border border-white/[0.06] overflow-hidden">
          <WorldMap bible={genesis} seed={seed} currentLocation={currentLocation} visited={visited} className="w-full aspect-square" />
        </div>
        {currentLocation && (
          <p className="text-xs text-muted-foreground/55 text-center">
            You are in <span className="text-amber-300/85 font-medium">{currentLocation}</span>.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** The story's protagonist + emergent canon cast. */
export function CastDialog({ open, onOpenChange, story }: { open: boolean; onOpenChange: (o: boolean) => void; story: Story }) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong border-white/15 sm:max-w-[460px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gold-text text-lg flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-400" />
              Cast
            </DialogTitle>
          </DialogHeader>
          {story.protagonist?.name && (
            <div className="glass-card rounded-lg p-3 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-amber-400/55 font-sans">
                  Protagonist
                </span>
                <span className="text-sm font-semibold text-foreground/85">
                  {story.protagonist.name}
                </span>
              </div>
              {story.protagonist.description && (
                <p className="text-xs text-muted-foreground/55 mt-1">{story.protagonist.description}</p>
              )}
            </div>
          )}
          {story.characters && story.characters.length > 0 ? (
            <ul className="space-y-2">
              {story.characters.map((c) => (
                <li key={c.name} className="glass-card rounded-lg p-3 border border-white/[0.07]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground/80">{c.name}</span>
                    {c.status && c.status !== 'alive' && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground/45">
                        {c.status}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground/55 mt-1">{c.description}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground/50 py-2">
              The cast will grow here as the story introduces new characters.
            </p>
          )}
        </DialogContent>
      </Dialog>
  )
}

/** Endings the reader has discovered, with progress toward the known total. */
export function EndingsDialog({
  open,
  onOpenChange,
  discoveredEndings,
  endingCount,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  discoveredEndings: DiscoveredEnding[]
  endingCount?: number
}) {
  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong border-white/15 sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gold-text text-lg flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Endings discovered
              {endingCount ? ` — ${discoveredEndings.length}/${endingCount}` : ''}
            </DialogTitle>
          </DialogHeader>

          {discoveredEndings.length === 0 ? (
            <p className="text-sm text-muted-foreground/55 py-4">
              You haven&apos;t reached an ending yet. Follow the paths to their conclusions — each
              one you find is recorded here.
            </p>
          ) : (
            <ul className="space-y-2">
              {discoveredEndings.map((e, i) => (
                <li key={e.id} className="glass-card rounded-lg p-3 border border-white/[0.07]">
                  <span className="text-[10px] uppercase tracking-widest text-amber-400/45 font-sans">
                    Ending {i + 1}
                  </span>
                  <p className="text-sm text-foreground/75 leading-snug mt-1">{e.excerpt}…</p>
                </li>
              ))}
            </ul>
          )}

          {endingCount != null && endingCount > discoveredEndings.length && (
            <p className="text-[11px] text-muted-foreground/40 font-sans text-center pt-1">
              {endingCount - discoveredEndings.length} more waiting to be found.
            </p>
          )}
        </DialogContent>
      </Dialog>
  )
}
