// ─── Cover & Reading Themes ────────────────────────────────────────────────────

export type CoverPattern = 'none' | 'stars' | 'grid' | 'dots' | 'lines' | 'diamonds' | 'waves' | 'crosshatch'
export type CoverFontStyle = 'serif' | 'gothic' | 'script' | 'mono'
export type CoverBorderFrame = 'none' | 'single' | 'double' | 'ornate' | 'runic' | 'thorn' | 'celestial' | 'vine'
export type PageStyle = 'parchment' | 'sepia' | 'night' | 'forest' | 'ocean' | 'rose'
export type AmbientEffect = 'none' | 'rain' | 'embers' | 'stars' | 'snow'

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

