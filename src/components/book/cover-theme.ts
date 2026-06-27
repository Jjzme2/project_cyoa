import type React from 'react'
import type { CoverTheme, CoverPattern, CoverFontStyle } from '@/types'

export const DEFAULT_COVER: CoverTheme = {
  fromColor: '#1e0840',
  toColor: '#0a0322',
  icon: '📖',
  pattern: 'none',
  fontStyle: 'serif',
  borderFrame: 'none',
  accentColor: '#fbbf24',
}

export const COLOR_PRESETS = [
  { label: 'Twilight',  from: '#1e0840', to: '#0a0322' },
  { label: 'Ember',     from: '#3d1200', to: '#180700' },
  { label: 'Abyss',     from: '#001838', to: '#000c18' },
  { label: 'Jade',      from: '#001e10', to: '#000a06' },
  { label: 'Crimson',   from: '#3d0012', to: '#180007' },
  { label: 'Obsidian',  from: '#18182e', to: '#08080f' },
  { label: 'Bronze',    from: '#2d1800', to: '#120b00' },
  { label: 'Frost',     from: '#00182d', to: '#00090f' },
  { label: 'Dusk',      from: '#280a2e', to: '#0f0412' },
  { label: 'Forest',    from: '#001a08', to: '#000703' },
  { label: 'Volcano',   from: '#3d0e00', to: '#150400' },
  { label: 'Midnight',  from: '#050520', to: '#02020c' },
]

export const COVER_ICONS = [
  '📖', '🐉', '🗡️', '👑', '🔮', '⚔️', '🏰', '🧙',
  '🦄', '🌙', '⚡', '🌊', '🌿', '🌸', '🌲', '🦅',
  '☀️', '⭐', '🌋', '🔍', '🕯️', '🗝️', '💀', '🦇',
  '🚀', '🌌', '🤖', '💫', '🌀', '🌹', '✨', '🦊',
  '🐺', '🌪️', '⚓', '🗺️', '🪄', '🔥', '💎', '🌺',
  '🦁', '🐦', '⚜️', '🌠', '🏹', '🧪', '🌑', '🫀',
]

export const PATTERNS: { id: CoverPattern; label: string }[] = [
  { id: 'none',       label: 'Plain'      },
  { id: 'stars',      label: 'Stars'      },
  { id: 'grid',       label: 'Grid'       },
  { id: 'dots',       label: 'Dots'       },
  { id: 'lines',      label: 'Filigree'   },
  { id: 'diamonds',   label: 'Diamonds'   },
  { id: 'waves',      label: 'Waves'      },
  { id: 'crosshatch', label: 'Crosshatch' },
]

export const FONT_STYLES: { id: CoverFontStyle; label: string; sample: string }[] = [
  { id: 'serif',  label: 'Classic',     sample: 'Georgia, "Times New Roman", serif' },
  { id: 'gothic', label: 'Gothic',      sample: '"Palatino Linotype", Palatino, serif' },
  { id: 'script', label: 'Handwritten', sample: 'cursive' },
  { id: 'mono',   label: 'Monospace',   sample: '"Courier New", Courier, monospace' },
]

export const ACCENT_PRESETS = [
  { label: 'Gold',    color: '#fbbf24' },
  { label: 'Silver',  color: '#d1d5db' },
  { label: 'Copper',  color: '#cd7f32' },
  { label: 'Crimson', color: '#ef4444' },
  { label: 'Emerald', color: '#34d399' },
  { label: 'Sapphire',color: '#60a5fa' },
  { label: 'Violet',  color: '#a78bfa' },
  { label: 'Rose',    color: '#fb7185' },
]

// ── Pattern helper ─────────────────────────────────────────────────────────────

export function patternStyle(pattern: CoverPattern): React.CSSProperties {
  switch (pattern) {
    case 'stars':
      return {
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }
    case 'grid':
      return {
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }
    case 'dots':
      return {
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1.5px, transparent 1.5px)',
        backgroundSize: '14px 14px',
      }
    case 'lines':
      return {
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 10px)',
      }
    case 'diamonds':
      return {
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 12px)',
      }
    case 'waves':
      return {
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 9px)',
        backgroundSize: '100% 18px',
      }
    case 'crosshatch':
      return {
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 16px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 16px)',
      }
    default:
      return { backgroundImage: 'none' }
  }
}

// ── Font family helper ─────────────────────────────────────────────────────────

export function coverFontFamily(style: CoverFontStyle): string {
  switch (style) {
    case 'gothic': return '"Palatino Linotype", Palatino, "Book Antiqua", serif'
    case 'script': return 'cursive'
    case 'mono':   return '"Courier New", Courier, monospace'
    default:       return 'Georgia, "Times New Roman", serif'
  }
}

// ── BookCoverPreview ───────────────────────────────────────────────────────────

