import type { WorldTheme, CoverPattern, CoverBorderFrame, AmbientEffect } from '@/types'

// The visual identity of a world. Reuses the cover vocabulary but speaks in
// "portals" and "atmosphere" rather than book covers.

export const DEFAULT_WORLD_THEME: WorldTheme = {
  fromColor: '#1e0840',
  toColor: '#0a0322',
  accentColor: '#fbbf24',
  emblem: '🌍',
  pattern: 'stars',
  ambientEffect: 'none',
  borderFrame: 'none',
}

export const WORLD_GRADIENTS = [
  { label: 'Twilight', from: '#1e0840', to: '#0a0322' },
  { label: 'Ember',    from: '#3d1200', to: '#180700' },
  { label: 'Abyss',    from: '#001838', to: '#000c18' },
  { label: 'Jade',     from: '#001e10', to: '#000a06' },
  { label: 'Crimson',  from: '#3d0012', to: '#180007' },
  { label: 'Obsidian', from: '#18182e', to: '#08080f' },
  { label: 'Bronze',   from: '#2d1800', to: '#120b00' },
  { label: 'Frost',    from: '#00182d', to: '#00090f' },
  { label: 'Dusk',     from: '#280a2e', to: '#0f0412' },
  { label: 'Forest',   from: '#001a08', to: '#000703' },
  { label: 'Volcano',  from: '#3d0e00', to: '#150400' },
  { label: 'Midnight', from: '#050520', to: '#02020c' },
]

export const WORLD_ACCENTS = [
  { label: 'Gold',     color: '#fbbf24' },
  { label: 'Silver',   color: '#d1d5db' },
  { label: 'Copper',   color: '#cd7f32' },
  { label: 'Crimson',  color: '#ef4444' },
  { label: 'Emerald',  color: '#34d399' },
  { label: 'Sapphire', color: '#60a5fa' },
  { label: 'Violet',   color: '#a78bfa' },
  { label: 'Rose',     color: '#fb7185' },
]

export const WORLD_EMBLEMS = [
  '🌍', '🏰', '🐉', '🌌', '⚔️', '🔮', '🗺️', '👑',
  '🌋', '🌲', '🏔️', '🏜️', '🌊', '⚡', '☀️', '🌙',
  '🚀', '🤖', '🛸', '⚙️', '🦅', '🐺', '🦂', '🕯️',
  '💀', '🩸', '🌹', '🍂', '❄️', '🔥', '⚜️', '🗡️',
]

export const WORLD_PATTERNS: { id: CoverPattern; label: string }[] = [
  { id: 'none',       label: 'Plain'      },
  { id: 'stars',      label: 'Starfield'  },
  { id: 'grid',       label: 'Grid'       },
  { id: 'dots',       label: 'Dots'       },
  { id: 'lines',      label: 'Filigree'   },
  { id: 'diamonds',   label: 'Diamonds'   },
  { id: 'waves',      label: 'Waves'      },
  { id: 'crosshatch', label: 'Crosshatch' },
]

// ── Tone → atmosphere ───────────────────────────────────────────────────────────
// Picking a tone suggests a coherent palette, so a world looks like it feels.

type ToneSuggestion = Omit<WorldTheme, 'borderFrame'>

const G = (label: string) => WORLD_GRADIENTS.find((g) => g.label === label)!

function suggestion(
  gradient: string,
  accent: string,
  emblem: string,
  pattern: CoverPattern,
  ambientEffect: AmbientEffect,
): ToneSuggestion {
  const g = G(gradient)
  return { fromColor: g.from, toColor: g.to, accentColor: accent, emblem, pattern, ambientEffect }
}

export const TONE_ATMOSPHERES: Record<string, ToneSuggestion> = {
  'Epic Fantasy':          suggestion('Twilight', '#fbbf24', '🏰', 'stars', 'motes'),
  'Dark Fantasy':          suggestion('Crimson',  '#ef4444', '🐉', 'crosshatch', 'embers'),
  'Dark Horror':           suggestion('Midnight', '#ef4444', '💀', 'none', 'mist'),
  'Gothic Horror':         suggestion('Dusk',     '#d1d5db', '🕯️', 'lines', 'mist'),
  'Cosmic Horror':         suggestion('Abyss',    '#a78bfa', '🌀', 'waves', 'mist'),
  'Supernatural Thriller': suggestion('Midnight', '#a78bfa', '🔮', 'dots', 'fireflies'),
  'Sci-Fi Adventure':      suggestion('Abyss',    '#60a5fa', '🚀', 'grid', 'stars'),
  'Space Opera':           suggestion('Midnight', '#60a5fa', '🌌', 'stars', 'stars'),
  'Cyberpunk Dystopia':    suggestion('Obsidian', '#fb7185', '🤖', 'grid', 'rain'),
  'Solarpunk':             suggestion('Jade',     '#34d399', '🌲', 'dots', 'fireflies'),
  'Cozy Mystery':          suggestion('Bronze',   '#cd7f32', '🔍', 'none', 'motes'),
  'Gritty Noir':           suggestion('Obsidian', '#d1d5db', '🕯️', 'lines', 'rain'),
  'Political Intrigue':    suggestion('Bronze',   '#fbbf24', '⚜️', 'diamonds', 'none'),
  'High Drama':            suggestion('Crimson',  '#fb7185', '🌹', 'none', 'petals'),
  'Romantic Drama':        suggestion('Dusk',     '#fb7185', '🌹', 'none', 'petals'),
  'Slice of Life':         suggestion('Forest',   '#34d399', '🍂', 'none', 'petals'),
  'Whimsical Fairy Tale':  suggestion('Dusk',     '#a78bfa', '🌙', 'stars', 'fireflies'),
  'Mythological Epic':     suggestion('Bronze',   '#fbbf24', '⚡', 'diamonds', 'motes'),
  'Post-Apocalyptic':      suggestion('Ember',    '#cd7f32', '🌋', 'none', 'embers'),
  'Survival Horror':       suggestion('Forest',   '#ef4444', '🌲', 'none', 'mist'),
  'LitRPG':                suggestion('Abyss',    '#60a5fa', '🗡️', 'grid', 'motes'),
  'Steampunk Adventure':   suggestion('Bronze',   '#cd7f32', '⚙️', 'crosshatch', 'embers'),
}

/** Suggest a coherent atmosphere for a tone, preserving the current border. */
export function themeForTone(tone: string, prev: WorldTheme): WorldTheme {
  const s = TONE_ATMOSPHERES[tone]
  if (!s) return prev
  return { ...prev, ...s }
}

// ── Surprise me ────────────────────────────────────────────────────────────────

const BORDER_IDS: CoverBorderFrame[] = [
  'none', 'single', 'double', 'ornate', 'runic', 'thorn', 'celestial', 'vine',
]
const AMBIENTS: AmbientEffect[] = [
  'none', 'rain', 'embers', 'stars', 'snow', 'fireflies', 'petals', 'mist', 'motes',
]

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function rollWorldTheme(prev: WorldTheme): WorldTheme {
  const g = pick(WORLD_GRADIENTS)
  return {
    ...prev,
    fromColor: g.from,
    toColor: g.to,
    accentColor: pick(WORLD_ACCENTS).color,
    emblem: pick(WORLD_EMBLEMS),
    pattern: pick(WORLD_PATTERNS).id,
    ambientEffect: pick(AMBIENTS),
    borderFrame: pick([...BORDER_IDS, 'none', 'none'] as CoverBorderFrame[]),
  }
}
