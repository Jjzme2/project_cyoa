import type { DirectorPersona } from '@/types'

/**
 * The authored "Director" — the directorial sensibility that shapes HOW each
 * chapter is told (its craft, mood, and pacing), always within the content
 * rating. This module is the single source of truth for the director, shared by:
 *   - the authoring UI (sliders, archetype presets, live preview)
 *   - the API routes (clamping / persistence)
 *   - the AI prompt builder (translating a persona into directorial notes)
 * so the author sees exactly the guidance the model receives.
 */

export type DirectorAxisKey =
  | 'experimental'
  | 'intensity'
  | 'darkness'
  | 'pace'
  | 'levity'
  | 'prose'
  | 'focus'

export interface DirectorAxis {
  key: DirectorAxisKey
  /** Label at the -1 pole. */
  left: string
  /** Label at the +1 pole. */
  right: string
  /** One-line description of the spectrum, shown under the slider. */
  hint: string
  /** Directorial note injected into the prompt when the axis leans positive. */
  positiveNote: string
  /** Directorial note injected when the axis leans negative. */
  negativeNote: string
}

/**
 * Order matters: it determines the order of notes in the prompt. The original
 * four axes keep their historical order; richer axes follow.
 */
export const DIRECTOR_AXES: readonly DirectorAxis[] = [
  {
    key: 'experimental',
    left: 'Traditional',
    right: 'Experimental',
    hint: 'Familiar, satisfying structure ↔ bold, rule-bending risks',
    positiveNote: 'Take bold, unconventional narrative risks and subvert expectations.',
    negativeNote: 'Favor classic, well-structured storytelling and familiar, satisfying beats.',
  },
  {
    key: 'intensity',
    left: 'Sensitive',
    right: 'Assertive',
    hint: 'Restrained nuance ↔ decisive, high-voltage turns',
    positiveNote: 'Direct with assertive force — decisive turns and high emotional voltage.',
    negativeNote: 'Direct with a sensitive, restrained hand — nuance, subtext, and quiet emotional beats.',
  },
  {
    key: 'darkness',
    left: 'Romantic',
    right: 'Scary',
    hint: 'Warmth and tenderness ↔ ominous dread',
    positiveNote: 'Lean into darker, ominous, frightening tones.',
    negativeNote: 'Lean into warmth, tenderness, and romance.',
  },
  {
    key: 'pace',
    left: 'Slow-burn',
    right: 'Propulsive',
    hint: 'Patient, breathing build ↔ relentless momentum',
    positiveNote: 'Keep events propulsive and fast-moving.',
    negativeNote: 'Let scenes breathe with a patient, slow-burn build.',
  },
  {
    key: 'levity',
    left: 'Solemn',
    right: 'Playful',
    hint: 'Grave and earnest ↔ witty and light',
    positiveNote: 'Let wit and levity through — playful banter and welcome moments of humor.',
    negativeNote: 'Hold a solemn, earnest register — grave stakes with little comic relief.',
  },
  {
    key: 'prose',
    left: 'Spare',
    right: 'Lyrical',
    hint: 'Clean and direct ↔ rich, image-laden language',
    positiveNote: 'Write lush, lyrical prose — vivid imagery and a strong sensory palette.',
    negativeNote: 'Write spare, clean prose — concrete, direct, and unadorned.',
  },
  {
    key: 'focus',
    left: 'Intimate',
    right: 'Epic',
    hint: 'Close character study ↔ sweeping scope',
    positiveNote: 'Direct through an epic lens — sweeping stakes and a sense of grand scale.',
    negativeNote: 'Hold an intimate lens — close character interiority over grand events.',
  },
]

/** Magnitude an axis must exceed before it contributes a directorial note. */
export const DIRECTOR_THRESHOLD = 0.3

export interface DirectorArchetype {
  id: string
  name: string
  emoji: string
  /** Short pitch shown on hover. */
  tagline: string
  persona: DirectorPersona
}

/**
 * One-click directorial styles. Each sets every axis plus a starter vision, so
 * authors can begin from a recognizable sensibility and fine-tune from there.
 */
export const DIRECTOR_ARCHETYPES: readonly DirectorArchetype[] = [
  {
    id: 'cozy',
    name: 'Cozy Hearth',
    emoji: '🫖',
    tagline: 'Gentle, warm, unhurried — comfort over conflict.',
    persona: {
      experimental: -0.3, intensity: -0.6, darkness: -0.8, pace: -0.5,
      levity: 0.5, prose: 0.2, focus: -0.7,
      vision: 'a tender story about everyday warmth and quiet courage',
    },
  },
  {
    id: 'thriller',
    name: 'Edge of the Seat',
    emoji: '🗡️',
    tagline: 'Relentless momentum and decisive turns.',
    persona: {
      experimental: 0.1, intensity: 0.8, darkness: 0.4, pace: 0.9,
      levity: -0.2, prose: -0.3, focus: 0,
      vision: 'a relentless thriller that never lets the reader breathe',
    },
  },
  {
    id: 'dread',
    name: 'Creeping Dread',
    emoji: '🕯️',
    tagline: 'Quiet horror where unease accumulates.',
    persona: {
      experimental: 0.2, intensity: -0.1, darkness: 0.9, pace: -0.4,
      levity: -0.7, prose: 0.5, focus: -0.4,
      vision: 'a quiet horror where dread accumulates in the shadows',
    },
  },
  {
    id: 'epic',
    name: 'Epic Saga',
    emoji: '🏔️',
    tagline: 'Sweeping scope, destiny, and grand stakes.',
    persona: {
      experimental: -0.2, intensity: 0.6, darkness: 0.2, pace: 0.4,
      levity: -0.1, prose: 0.6, focus: 0.9,
      vision: 'a sweeping epic of kingdoms, destiny, and grand stakes',
    },
  },
  {
    id: 'dream',
    name: 'Dream Logic',
    emoji: '🌀',
    tagline: 'Surreal and rule-bending, lyrical and strange.',
    persona: {
      experimental: 0.9, intensity: 0.1, darkness: 0.3, pace: -0.2,
      levity: 0, prose: 0.8, focus: -0.2,
      vision: 'a surreal, dreamlike tale that bends its own rules',
    },
  },
  {
    id: 'caper',
    name: 'Wry Caper',
    emoji: '🎭',
    tagline: 'Witty, fast, full of banter and narrow escapes.',
    persona: {
      experimental: 0.3, intensity: 0.3, darkness: -0.4, pace: 0.6,
      levity: 0.9, prose: -0.1, focus: -0.1,
      vision: 'a witty caper full of banter, mischief, and narrow escapes',
    },
  },
  {
    id: 'romance',
    name: 'Tender Romance',
    emoji: '🌹',
    tagline: 'Longing, intimacy, and small brave gestures.',
    persona: {
      experimental: -0.1, intensity: -0.4, darkness: -0.7, pace: -0.5,
      levity: 0.3, prose: 0.5, focus: -0.8,
      vision: 'an aching romance built on longing and small, brave gestures',
    },
  },
  {
    id: 'grimdark',
    name: 'Grimdark',
    emoji: '⚔️',
    tagline: 'Brutal, morally grey, every victory costs.',
    persona: {
      experimental: 0.1, intensity: 0.7, darkness: 0.8, pace: 0.3,
      levity: -0.8, prose: 0.1, focus: 0.3,
      vision: 'a brutal, morally grey world where every victory costs',
    },
  },
]

/** A blank persona with every axis centered. */
export function emptyDirector(): DirectorPersona {
  return {
    experimental: 0, intensity: 0, darkness: 0, pace: 0,
    levity: 0, prose: 0, focus: 0, vision: '',
  }
}

function axisValue(d: DirectorPersona, key: DirectorAxisKey): number {
  return Number((d as Record<DirectorAxisKey, number | undefined>)[key]) || 0
}

/** True if the author has meaningfully moved any axis or written a vision. */
export function isDirectorMeaningful(d: DirectorPersona | null | undefined): boolean {
  if (!d) return false
  if (DIRECTOR_AXES.some((a) => Math.abs(axisValue(d, a.key)) > 0.001)) return true
  return !!(d.vision && d.vision.trim())
}

/** True if two personas are effectively identical (used to highlight a preset). */
export function personaMatches(a: DirectorPersona, b: DirectorPersona): boolean {
  for (const axis of DIRECTOR_AXES) {
    if (Math.abs(axisValue(a, axis.key) - axisValue(b, axis.key)) > 0.05) return false
  }
  return (a.vision ?? '').trim() === (b.vision ?? '').trim()
}

/**
 * Translate a persona into natural-language directorial notes. This is the
 * single source of truth the authoring UI previews and the prompt builder ships.
 */
export function describeDirector(d: DirectorPersona | null | undefined): string[] {
  if (!d) return []
  const notes: string[] = []
  for (const axis of DIRECTOR_AXES) {
    const v = axisValue(d, axis.key)
    if (v > DIRECTOR_THRESHOLD) notes.push(axis.positiveNote)
    else if (v < -DIRECTOR_THRESHOLD) notes.push(axis.negativeNote)
  }
  if (d.vision && d.vision.trim()) notes.push(`Honor the director's stated vision: "${d.vision.trim()}"`)
  return notes
}

/**
 * Translate a persona into cover-art direction (palette, composition, mood) —
 * same axes as `describeDirector`, but phrased for an illustrator instead of
 * a prose stylist, so generated cover art matches the story's intended tone.
 */
export function describeDirectorForCoverArt(d: DirectorPersona | null | undefined): string[] {
  if (!d) return []
  const notes: string[] = []
  const lean = (key: DirectorAxisKey, positive: string, negative: string) => {
    const v = axisValue(d, key)
    if (v > DIRECTOR_THRESHOLD) notes.push(positive)
    else if (v < -DIRECTOR_THRESHOLD) notes.push(negative)
  }
  lean('darkness', 'an ominous, shadow-heavy palette', 'a warm, tender palette with soft, inviting light')
  lean('intensity', 'a bold, high-contrast composition', 'a restrained composition with quiet emotional weight')
  lean('focus', 'epic, sweeping scale', 'intimate, close framing on a single figure')
  lean('pace', 'dynamic, mid-action energy', 'still, contemplative stillness')
  lean('levity', 'a playful, whimsical tone', 'a solemn, grave tone')
  lean('experimental', 'surreal, unconventional imagery', 'classic, traditional genre imagery')
  lean('prose', 'richly ornate, painterly detail', 'a clean, spare visual style')
  if (d.vision && d.vision.trim()) notes.push(`honoring the director's stated vision: "${d.vision.trim()}"`)
  return notes
}

const clampAxis = (v: unknown): number => Math.max(-1, Math.min(1, Number(v) || 0))

/**
 * Clamp and normalize an untrusted persona from a request body. Returns null if
 * the author didn't meaningfully set anything, so callers can omit it entirely.
 */
export function sanitizeDirector(input: unknown): DirectorPersona | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const d: DirectorPersona = {
    experimental: clampAxis(raw.experimental),
    intensity: clampAxis(raw.intensity),
    darkness: clampAxis(raw.darkness),
    pace: clampAxis(raw.pace),
    levity: clampAxis(raw.levity),
    prose: clampAxis(raw.prose),
    focus: clampAxis(raw.focus),
    vision: typeof raw.vision === 'string' ? raw.vision.trim().slice(0, 300) : '',
  }
  return isDirectorMeaningful(d) ? d : null
}
