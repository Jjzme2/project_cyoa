import type { StoryNode, EndingType, ReadingTheme, AmbientEffect } from '@/types'

export type ResourceMap = Record<string, number | string | string[] | number[]>

export interface DiscoveredEnding {
  id: string
  excerpt: string
  /** Set for an authored, definitive ending (vs. an unwritten frontier). */
  title?: string
  type?: EndingType
}

const ENDINGS_KEY = (storyId: string) => `cyoa:endings:${storyId}`

export function loadDiscoveredEndings(storyId: string): DiscoveredEnding[] {
  try {
    return JSON.parse(localStorage.getItem(ENDINGS_KEY(storyId)) || '[]')
  } catch {
    return []
  }
}

// A page with no onward navigable path is an ending / story frontier.
export function isEndingNode(n: StoryNode): boolean {
  return !n.slots.some((s) => s.filled && s.childNodeId)
}

// ── Page theme palette ─────────────────────────────────────────────────────────
export const PAGE_PALETTES: Record<string, { bg: string; text: string; spine: string }> = {
  parchment: { bg: '#f0e6d0', text: '#3d2b1f', spine: 'rgba(61,43,31,0.15)' },
  sepia:     { bg: '#d4b896', text: '#2d1a0e', spine: 'rgba(45,26,14,0.15)' },
  night:     { bg: '#1a1a2e', text: '#c0c8e0', spine: 'rgba(192,200,224,0.10)' },
  forest:    { bg: '#e8f0e0', text: '#1a2d15', spine: 'rgba(26,45,21,0.12)' },
  ocean:     { bg: '#e0eef0', text: '#0d2535', spine: 'rgba(13,37,53,0.12)' },
  rose:      { bg: '#f0e0e4', text: '#2d1518', spine: 'rgba(45,21,24,0.12)' },
  papyrus:   { bg: '#e6dcc0', text: '#43331b', spine: 'rgba(67,51,27,0.14)' },
  dusk:      { bg: '#2a2440', text: '#d8d2ea', spine: 'rgba(216,210,234,0.10)' },
  slate:     { bg: '#222831', text: '#cfd6df', spine: 'rgba(207,214,223,0.10)' },
  candlelight: { bg: '#f4dfb8', text: '#4a2f12', spine: 'rgba(74,47,18,0.16)' },
  moonlit:     { bg: '#dde6f0', text: '#1c2733', spine: 'rgba(28,39,51,0.12)' },
  aurora:      { bg: '#16232f', text: '#bfe8de', spine: 'rgba(191,232,222,0.10)' },
  storm:       { bg: '#232a35', text: '#c7d2de', spine: 'rgba(199,210,222,0.10)' },
}

/**
 * The story's own ambient effect wins; an untouched story (still 'none')
 * inherits its world's default ambient, so a world feels consistently
 * atmospheric even before an author has set anything on any one story.
 */
export function resolveAmbientVisual(
  theme: ReadingTheme | null | undefined,
  worldDefault?: AmbientEffect | null,
): AmbientEffect {
  const effect = theme?.ambientEffect
  if (effect && effect !== 'none') return effect
  return worldDefault ?? 'none'
}

/**
 * The ambient VISUAL (`AmbientBackground`, resolved above) is always
 * author/world-set and unconditional. The ambient SOUND is resolved
 * separately so it can diverge from the visual: it can auto-follow a
 * per-chapter scene cue, or be silenced outright, independent of what's on
 * screen.
 */
export function resolveAmbientSound(
  theme: ReadingTheme | null | undefined,
  sceneAmbient?: AmbientEffect | null,
  worldDefault?: AmbientEffect | null,
): AmbientEffect {
  const mode = theme?.ambientSoundMode ?? 'match'
  if (mode === 'off') return 'none'
  if (mode === 'auto' && sceneAmbient) return sceneAmbient
  return resolveAmbientVisual(theme, worldDefault)
}

export function saveDiscoveredEndings(storyId: string, endings: DiscoveredEnding[]) {
  try {
    localStorage.setItem(ENDINGS_KEY(storyId), JSON.stringify(endings))
  } catch {}
}

export type Direction = 'forward' | 'back'

export const pageVariants = {
  enter: (dir: Direction) => ({
    rotateY: dir === 'forward' ? 32 : -32,
    x: dir === 'forward' ? '7%' : '-7%',
    opacity: 0,
    scale: 0.955,
  }),
  center: { rotateY: 0, x: 0, opacity: 1, scale: 1 },
  exit: (dir: Direction) => ({
    rotateY: dir === 'forward' ? -32 : 32,
    x: dir === 'forward' ? '-7%' : '7%',
    opacity: 0,
    scale: 0.955,
  }),
}

export const pageTransition = {
  duration: 0.54,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
}

const LOCAL_KEY = (storyId: string) => `cyoa:progress:${storyId}`

export function loadLocalProgress(storyId: string): {
  currentNodeId: string
  nodeHistory: string[]
  resources?: Record<string, number | string | string[] | number[]>
  resourcesHistory?: Record<string, number | string | string[] | number[]>[]
} | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(storyId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveLocalProgress(
  storyId: string,
  currentNodeId: string,
  nodeHistory: string[],
  resources?: Record<string, number | string | string[] | number[]>,
  resourcesHistory?: Record<string, number | string | string[] | number[]>[],
) {
  try {
    localStorage.setItem(
      LOCAL_KEY(storyId),
      JSON.stringify({ currentNodeId, nodeHistory, resources, resourcesHistory }),
    )
  } catch {}
}
