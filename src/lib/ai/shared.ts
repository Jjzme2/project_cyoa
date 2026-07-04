import { ENDING_TYPES, type EndingType, type StoryCharacter } from '@/types'

/**
 * Nudges every AI naming surface (emergent characters, protagonists) away from
 * the small set of names LLMs default to when given free rein, so different
 * stories don't all end up drawing from the same handful of names.
 */
export const NAME_DIVERSITY_NOTE =
  "avoid generic, overused fantasy names (e.g. Kael, Kaelen, Aiden, Aria, Lyra, Elara, Zephyr, Thorne, Raven, Seraphina) — pick something distinctive that fits this world's culture and tone, varied in length, origin, and sound from any names already established here"

export class PromptRejectedError extends Error {
  constructor(public readonly reason: string) {
    super(reason)
    this.name = 'PromptRejectedError'
  }
}

export function parseAIResponse(text: string): {
  content: string
  choices: string[]
  newCharacters: StoryCharacter[]
  location?: string
  ending?: { title: string; type: EndingType }
} {
  const rejectionMatch = text.match(/^REJECTED:\s*(.+)/im)
  if (rejectionMatch) {
    throw new PromptRejectedError(rejectionMatch[1].trim())
  }

  // A definitive conclusion: `ENDING: <title> | <type>`. When present, this
  // chapter is terminal (we drop any choices the model also emitted).
  const ending = parseEnding(text)

  // Where this chapter takes place — used for the world map / location tracking.
  const locMatch = text.match(/^LOCATION:\s*(.+)/im)
  const location = locMatch ? locMatch[1].trim().slice(0, 80) || undefined : undefined

  const choicePattern = /CHOICE_(\d):\s*(.+)/g
  const choices: string[] = []
  let match

  while ((match = choicePattern.exec(text)) !== null) {
    choices.push(match[2].trim())
  }

  // Emergent characters the model flagged as newly introduced this chapter.
  const newCharacters: StoryCharacter[] = []
  const charPattern = /NEW_CHARACTER:\s*(.+)/gi
  let cMatch
  while ((cMatch = charPattern.exec(text)) !== null) {
    const raw = cMatch[1].trim()
    const [name, ...rest] = raw.split(/\s+[—-]\s+/)
    if (name) {
      newCharacters.push({
        name: name.trim().slice(0, 60),
        description: rest.join(' — ').trim().slice(0, 200) || undefined,
        status: 'alive',
      })
    }
  }

  const content = text
    .replace(/CHOICE_\d:.+/g, '')
    .replace(/NEW_CHARACTER:.+/gi, '')
    .replace(/^LOCATION:.+/gim, '')
    .replace(/^ENDING:.+/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // A terminal chapter has no onward choices, even if the model emitted some.
  return {
    content,
    choices: ending ? [] : choices.slice(0, 3),
    newCharacters,
    location,
    ...(ending ? { ending } : {}),
  }
}

/** Parse an `ENDING: <title> | <type>` line, coercing an unknown/blank type. */
function parseEnding(text: string): { title: string; type: EndingType } | undefined {
  const m = text.match(/^ENDING:\s*(.+)/im)
  if (!m) return undefined
  const [titleRaw, typeRaw] = m[1].split('|')
  const title = (titleRaw ?? '').trim().slice(0, 80) || 'The End'
  const t = (typeRaw ?? '').trim().toLowerCase()
  const type = (ENDING_TYPES as readonly string[]).includes(t) ? (t as EndingType) : 'bittersweet'
  return { title, type }
}

export const VALID_TONES = [
  'Epic Fantasy',
  'Dark Fantasy',
  'Dark Horror',
  'Gothic Horror',
  'Cosmic Horror',
  'Supernatural Thriller',
  'Sci-Fi Adventure',
  'Space Opera',
  'Cyberpunk Dystopia',
  'Solarpunk',
  'Cozy Mystery',
  'Gritty Noir',
  'Political Intrigue',
  'High Drama',
  'Romantic Drama',
  'Slice of Life',
  'Whimsical Fairy Tale',
  'Mythological Epic',
  'Post-Apocalyptic',
  'Survival Horror',
  'LitRPG',
  'Steampunk Adventure',
] as const

export const VALID_TAGS = [
  'Fantasy', 'Dark Fantasy', 'Urban Fantasy', 'Fairy Tale', 'Mythology',
  'Horror', 'Gothic', 'Cosmic Horror', 'Supernatural',
  'Sci-Fi', 'Space Opera', 'Cyberpunk', 'Biopunk', 'Solarpunk',
  'Mystery', 'Noir', 'Thriller', 'Psychological',
  'Adventure', 'Survival', 'Action', 'Political',
  'Romance', 'Comedy', 'Slice of Life', 'Drama',
  'Historical', 'Alternate History', 'Post-Apocalyptic', 'Steampunk', 'Western',
  'LitRPG', 'Magical Realism',
] as const

export function tryParseJSON(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(cleaned)
}

/** Hard cap on free-text user input folded into a model prompt. */
export function pickStr(v: unknown, fallback: string, max: number): string {
  const s = typeof v === 'string' ? v.trim() : ''
  return (s || fallback).slice(0, max)
}

/**
 * The ELABORATION half of hybrid world genesis. Takes the procedural skeleton
 * (regions, factions, characters, history — already cross-referenced) and enriches
 * its prose to fit the world's premise and tone, in ONE call. The skeleton stays
 * authoritative for all names and relationships (merged back by index), so the
 * LLM can't break the structure. Fails open to the skeleton.
 */
