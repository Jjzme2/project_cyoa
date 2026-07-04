// ─── Cover & Reading Themes ────────────────────────────────────────────────────

export type CoverPattern = 'none' | 'stars' | 'grid' | 'dots' | 'lines' | 'diamonds' | 'waves' | 'crosshatch' | 'chevron' | 'hex'
export type CoverFontStyle = 'serif' | 'gothic' | 'script' | 'mono'
export type CoverBorderFrame = 'none' | 'single' | 'double' | 'ornate' | 'runic' | 'thorn' | 'celestial' | 'vine'
export type PageStyle =
  | 'parchment' | 'sepia' | 'night' | 'forest' | 'ocean' | 'rose' | 'papyrus' | 'dusk' | 'slate'
  | 'candlelight' | 'moonlit' | 'aurora' | 'storm'
export type AmbientEffect =
  | 'none' | 'rain' | 'embers' | 'stars' | 'snow'
  | 'fireflies' | 'petals' | 'mist' | 'motes'
  | 'aurora' | 'lightning' | 'moonbeams'

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

/**
 * How the ambient SOUND relates to the ambient VISUAL (`ambientEffect`):
 *   - 'match' (default): sound mirrors the visual, as it always has.
 *   - 'auto': sound switches per-chapter to whatever the scene calls for
 *     (falls back to the visual when a chapter has no detected cue).
 *   - 'off': no ambient sound regardless of the visual or the reader's
 *     global ambient-sound toggle.
 */
export type AmbientSoundMode = 'match' | 'auto' | 'off'

export interface ReadingTheme {
  pageStyle: PageStyle
  ambientEffect: AmbientEffect
  ambientSoundMode?: AmbientSoundMode
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

