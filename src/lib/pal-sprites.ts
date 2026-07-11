import { STAGE_LEVELS, type PetMood, type PetSpecies } from './pet'

// ─── Reader Pal sprite sheets — drop-in animation art ─────────────────────────
//
// Convention over configuration, so new art (or whole new species) works with
// ZERO code changes (full authoring spec in `public/pals/README.md`):
//
//   public/pals/{species}.png          — base sheet for a species
//   public/pals/{species}-l{level}.png — optional per-evolution sheet
//                                        (level ∈ 1/2/4/6/8/10, the stage bands)
//
// Every sheet is 5 ROWS of SQUARE frames, in this fixed row order:
//   idle · sleep · scared · excited · sad
// Any frame count, any resolution — the renderer measures the image
// (cell = height / 5, frames = width / cell), so no manifest is ever needed.
// Sprite art is the pal's default look; missing art falls back down the chain
// (stage sheet → base sheet), with emoji only as a last resort for a species
// that has no sheets at all yet.

export const PAL_ANIMATIONS = ['idle', 'sleep', 'scared', 'excited', 'sad'] as const
export type PalAnimation = (typeof PAL_ANIMATIONS)[number]

/** Fixed row count/order every sheet must follow. */
export const SHEET_ROWS = PAL_ANIMATIONS.length

export function rowIndexFor(animation: PalAnimation): number {
  const i = PAL_ANIMATIONS.indexOf(animation)
  return i >= 0 ? i : 0
}

/** Playback speed per animation (frames/second). */
export const ANIMATION_FPS: Record<PalAnimation, number> = {
  idle: 6,
  sleep: 3,
  scared: 10,
  excited: 10,
  sad: 5,
}

/**
 * Sheet URLs to try for a species at a given evolution stage, most specific
 * first: the current stage's sheet, then each earlier stage's (so art added
 * gradually still shows the closest form), then the species base sheet.
 */
export function spriteSheetCandidates(species: PetSpecies, stageMinLevel: number): string[] {
  const bands = STAGE_LEVELS.filter((l) => l <= stageMinLevel).sort((a, b) => b - a)
  return [...bands.map((l) => `/pals/${species}-l${l}.png`), `/pals/${species}.png`]
}

/** The pal's resting animation for a mood (profile panel, companion baseline). */
export function animationForMood(mood: PetMood): PalAnimation {
  switch (mood) {
    case 'thrilled': return 'excited'
    case 'active': return 'idle'
    case 'idle': return 'sad' // it misses you
    case 'dozing': return 'sleep'
  }
}

/** The story tension (0..1, from the Living World pulse) at which the pal gets scared. */
export const SCARED_TENSION = 0.7

export interface CompanionContext {
  mood: PetMood
  /** Living-world tension at the current chapter (0..1), when known. */
  tension?: number
  /** The current chapter is a definitive ending. */
  isEnding: boolean
  /** No page turn for a while — the pal nods off. */
  inactive: boolean
  /** The reader just patted the pal. */
  patted: boolean
}

/**
 * What the in-reader companion should play right now. Priority: a pat always
 * lands (comfort beats fear), endings are celebrated, tense chapters frighten,
 * a long-idle read lulls to sleep, otherwise the mood's resting animation.
 */
export function companionAnimation(ctx: CompanionContext): PalAnimation {
  if (ctx.patted) return 'excited'
  if (ctx.isEnding) return 'excited'
  if ((ctx.tension ?? 0) >= SCARED_TENSION) return 'scared'
  if (ctx.inactive) return 'sleep'
  return animationForMood(ctx.mood)
}
