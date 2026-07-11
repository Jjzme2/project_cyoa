'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  ANIMATION_FPS,
  SHEET_ROWS,
  rowIndexFor,
  spriteSheetCandidates,
  type PalAnimation,
} from '@/lib/pal-sprites'
import type { PetSpecies } from '@/lib/pet'

interface SheetInfo {
  url: string
  /** Square frame size in source pixels (image height / 5 rows). */
  cell: number
  /** Frames per row (image width / cell). */
  frames: number
}

// Resolved sheets, cached for the session so a once-found sheet is never
// re-probed. Deliberately NOT negative-cached: art is added over time (an
// author drops a new PNG in `public/pals/`), so a "not found yet" result must
// be retried on the next mount rather than remembered for the rest of the
// browser session — otherwise newly-added art wouldn't appear without a hard
// reload. Key: `${species}:${stageMinLevel}`.
const sheetCache = new Map<string, SheetInfo>()

function probe(url: string): Promise<SheetInfo | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const cell = Math.floor(img.naturalHeight / SHEET_ROWS)
      if (cell < 1) return resolve(null) // malformed sheet — treat as missing
      resolve({ url, cell, frames: Math.max(1, Math.floor(img.naturalWidth / cell)) })
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Exported for testing the no-negative-cache contract; not part of the public API. */
export async function resolveSheet(species: PetSpecies, stageMinLevel: number): Promise<SheetInfo | null> {
  const key = `${species}:${stageMinLevel}`
  const cached = sheetCache.get(key)
  if (cached) return cached
  for (const url of spriteSheetCandidates(species, stageMinLevel)) {
    const info = await probe(url)
    if (info) {
      sheetCache.set(key, info)
      return info
    }
  }
  return null
}

/**
 * The pal itself: plays the requested animation from the species' sprite sheet
 * (see `public/pals/README.md` for the drop-in authoring spec). Sprite art is
 * the default look — while a sheet resolves the box stays empty (never an
 * emoji flash), and the stage emoji appears only as a last resort when a
 * species has no art at all yet. Reduced motion (or `still`) holds the
 * animation's first frame instead of cycling.
 */
export function PalSprite({
  species,
  stageMinLevel,
  fallbackEmoji,
  animation,
  size,
  still = false,
  className = '',
}: {
  species: PetSpecies
  stageMinLevel: number
  fallbackEmoji: string
  animation: PalAnimation
  size: number
  /** Hold the animation's first frame (static previews like picker swatches). */
  still?: boolean
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const key = `${species}:${stageMinLevel}`
  // Keyed by species+stage so a change simply renders the fallback until the
  // new sheet resolves — no state reset inside the effect.
  const [resolved, setResolved] = useState<{ key: string; info: SheetInfo | null } | null>(null)
  // Free-running animation clock; the frame is derived with modulo, so neither
  // sheet nor animation changes need a counter reset.
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    resolveSheet(species, stageMinLevel).then((info) => {
      if (alive) setResolved({ key: `${species}:${stageMinLevel}`, info })
    })
    return () => { alive = false }
  }, [species, stageMinLevel])

  const sheet = resolved && resolved.key === key ? resolved.info : undefined // undefined = loading

  const holdFrame = reduceMotion || still

  useEffect(() => {
    if (!sheet || holdFrame || sheet.frames <= 1) return
    const interval = setInterval(
      () => setTick((t) => t + 1),
      Math.round(1000 / ANIMATION_FPS[animation]),
    )
    return () => clearInterval(interval)
  }, [sheet, animation, holdFrame])

  if (!sheet) {
    // undefined = still resolving: hold an empty box of the final size so the
    // sprite pops in without an emoji flash or layout shift. null = resolution
    // finished and this species truly has no art yet — only then show emoji.
    return (
      <span
        aria-hidden
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.82) }}
      >
        {sheet === null ? fallbackEmoji : null}
      </span>
    )
  }

  const frame = holdFrame ? 0 : tick % sheet.frames

  return (
    <span
      aria-hidden
      className={`inline-block ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sheet.url})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${sheet.frames * size}px ${SHEET_ROWS * size}px`,
        backgroundPosition: `-${frame * size}px -${rowIndexFor(animation) * size}px`,
        imageRendering: 'pixelated',
      }}
    />
  )
}
