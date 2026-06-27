// ─── Cover & Reading Themes ────────────────────────────────────────────────────

export type CoverPattern = 'none' | 'stars' | 'grid' | 'dots' | 'lines' | 'diamonds' | 'waves' | 'crosshatch'
export type CoverFontStyle = 'serif' | 'gothic' | 'script' | 'mono'
export type CoverBorderFrame = 'none' | 'single' | 'double' | 'ornate' | 'runic' | 'thorn' | 'celestial' | 'vine'
export type PageStyle = 'parchment' | 'sepia' | 'night' | 'forest' | 'ocean' | 'rose' | 'papyrus' | 'dusk' | 'slate'
export type AmbientEffect =
  | 'none' | 'rain' | 'embers' | 'stars' | 'snow'
  | 'fireflies' | 'petals' | 'mist' | 'motes'

export interface CoverTheme {
  fromColor: string
  toColor: string
  icon: string
  pattern: CoverPattern
  fontStyle: CoverFontStyle
  coverImageUrl?: string
  borderFrame?: CoverBorderFrame
  accentColor?: string
}

export interface ReadingTheme {
  pageStyle: PageStyle
  ambientEffect: AmbientEffect
}

/**
 * The visual identity of a world — its "portal" on cards and detail pages.
 * Reuses the cover vocabulary (gradient, pattern, accent) plus an emblem and
 * an atmospheric ambient effect, so a world feels like a distinct place.
 */
export interface WorldTheme {
  fromColor: string
  toColor: string
  accentColor: string
  emblem: string
  pattern: CoverPattern
  ambientEffect: AmbientEffect
  borderFrame?: CoverBorderFrame
}

