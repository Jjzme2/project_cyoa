/**
 * Authoring presets for a world's per-story style options.
 *
 * `StyleOptionDraft` mirrors the world-creator's editor state (choices as a
 * comma-separated string). The first choice in each list is the bundle's
 * signature default — stories default into it but can switch.
 */

export interface StyleOptionDraft {
  label: string
  choices: string
}

/** Single quick-add options (one click adds one option). */
export const STYLE_OPTION_PRESETS: StyleOptionDraft[] = [
  { label: 'Narration', choices: 'First person, Second person, Third limited, Third omniscient' },
  { label: 'Tense', choices: 'Past tense, Present tense' },
  { label: 'Tone register', choices: 'Formal, Conversational, Archaic, Terse' },
  { label: 'Pacing', choices: 'Slow-burn, Brisk, Breakneck' },
  { label: 'Sentence rhythm', choices: 'Long and flowing, Short and punchy, Varied' },
  { label: 'Dialogue density', choices: 'Dialogue-heavy, Balanced, Sparse' },
  { label: 'Humor', choices: 'None, Dry wit, Broad comedy' },
  { label: 'Chapter endings', choices: 'Cliffhanger, Soft beat, Reflective' },
  { label: 'Rhyme scheme', choices: 'ABAB, ABBA, AABB, Free verse' },
]

export interface CuratedBundle {
  id: string
  name: string
  description: string
  options: StyleOptionDraft[]
}

/** Curated profiles: each configures several options at once with a coherent voice. */
export const CURATED_STYLE_BUNDLES: CuratedBundle[] = [
  {
    id: 'noir',
    name: 'Hard-boiled noir',
    description: 'First-person, terse, dialogue-driven crime.',
    options: [
      { label: 'Narration', choices: 'First person, Third limited' },
      { label: 'Tense', choices: 'Past tense, Present tense' },
      { label: 'Tone register', choices: 'Terse, Conversational' },
      { label: 'Sentence rhythm', choices: 'Short and punchy, Varied' },
      { label: 'Dialogue density', choices: 'Dialogue-heavy, Balanced' },
      { label: 'Humor', choices: 'Dry wit, None' },
    ],
  },
  {
    id: 'lyrical_fantasy',
    name: 'Lyrical high fantasy',
    description: 'Sweeping, ornate, slow-burning.',
    options: [
      { label: 'Narration', choices: 'Third omniscient, Third limited' },
      { label: 'Tone register', choices: 'Archaic, Formal' },
      { label: 'Sentence rhythm', choices: 'Long and flowing, Varied' },
      { label: 'Pacing', choices: 'Slow-burn, Brisk' },
      { label: 'Chapter endings', choices: 'Reflective, Cliffhanger' },
    ],
  },
  {
    id: 'cosmic_dread',
    name: 'Cosmic dread',
    description: 'Quiet, formal, mounting horror.',
    options: [
      { label: 'Narration', choices: 'First person, Third limited' },
      { label: 'Tense', choices: 'Past tense, Present tense' },
      { label: 'Tone register', choices: 'Formal, Archaic' },
      { label: 'Pacing', choices: 'Slow-burn, Brisk' },
      { label: 'Sentence rhythm', choices: 'Long and flowing, Varied' },
      { label: 'Chapter endings', choices: 'Cliffhanger, Reflective' },
    ],
  },
  {
    id: 'cozy_hearth',
    name: 'Cozy hearth',
    description: 'Warm, gentle, character-first.',
    options: [
      { label: 'Narration', choices: 'Third limited, First person' },
      { label: 'Tone register', choices: 'Conversational, Formal' },
      { label: 'Humor', choices: 'Dry wit, Broad comedy' },
      { label: 'Pacing', choices: 'Slow-burn, Brisk' },
      { label: 'Dialogue density', choices: 'Balanced, Dialogue-heavy' },
      { label: 'Chapter endings', choices: 'Soft beat, Reflective' },
    ],
  },
  {
    id: 'pulp_serial',
    name: 'Pulp serial',
    description: 'Breakneck, punchy, cliffhanger-driven.',
    options: [
      { label: 'Narration', choices: 'Third limited, First person' },
      { label: 'Tense', choices: 'Past tense, Present tense' },
      { label: 'Pacing', choices: 'Breakneck, Brisk' },
      { label: 'Sentence rhythm', choices: 'Short and punchy, Varied' },
      { label: 'Chapter endings', choices: 'Cliffhanger, Soft beat' },
      { label: 'Humor', choices: 'Broad comedy, Dry wit' },
    ],
  },
  {
    id: 'mythic_epic',
    name: 'Mythic epic',
    description: 'Grand, oral-tradition cadence.',
    options: [
      { label: 'Narration', choices: 'Third omniscient' },
      { label: 'Tone register', choices: 'Archaic, Formal' },
      { label: 'Sentence rhythm', choices: 'Long and flowing, Varied' },
      { label: 'Pacing', choices: 'Slow-burn, Brisk' },
      { label: 'Chapter endings', choices: 'Reflective, Cliffhanger' },
    ],
  },
  {
    id: 'verse_bound',
    name: 'Verse-bound',
    description: 'Poetry-forward, formal meter & rhyme.',
    options: [
      { label: 'Rhyme scheme', choices: 'ABAB, ABBA, AABB, Free verse' },
      { label: 'Sentence rhythm', choices: 'Long and flowing, Varied' },
      { label: 'Tone register', choices: 'Archaic, Formal' },
    ],
  },
]

/**
 * Merge a bundle's options into the existing editor list, replacing any option
 * with the same label (case-insensitive) in place and appending the rest. Pure.
 */
export function applyBundle(existing: StyleOptionDraft[], bundle: CuratedBundle): StyleOptionDraft[] {
  const byLabel = new Map(existing.map((o) => [o.label.trim().toLowerCase(), o]))
  for (const opt of bundle.options) {
    byLabel.set(opt.label.trim().toLowerCase(), { ...opt })
  }
  return [...byLabel.values()]
}
