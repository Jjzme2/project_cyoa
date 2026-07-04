import type { ContentRating } from '@/types'
import { VALID_TONES, VALID_TAGS, NAME_DIVERSITY_NOTE, tryParseJSON } from './shared'
import { runTextWaterfall } from './waterfall'
import { userInputBlock } from './prompts'

/**
 * The interactive "Inspire with AI" backend: clarifying questions, field-selective
 * generation, and per-field reroll. Distinct from `content.ts`, which holds the
 * one-shot generators used by the in-story engine and sagas.
 */

export type AssistType = 'world' | 'story'

/** A clarifying question and the author's (optional) answer. */
export interface AssistAnswer {
  question: string
  answer: string
}

/** Bounded world context handed to story assists (already sanitized at the API). */
export interface AssistWorldContext {
  name: string
  description: string
  lore: string
  rules: string
  tone: string
  rating?: ContentRating
}

/** The fields each assist type can produce, in author-facing order. */
export const WORLD_ASSIST_FIELDS = ['name', 'description', 'lore', 'rules', 'tone', 'rating'] as const
export const STORY_ASSIST_FIELDS = [
  'title', 'description', 'opening', 'protagonistName', 'protagonistDesc',
  'choice1', 'choice2', 'choice3', 'tags',
] as const

const WORLD_FIELD_SPECS: Record<string, string> = {
  name: '"name": an evocative world name, 2-5 words',
  description: '"description": a vivid 1-2 sentence hook (under 240 characters)',
  lore: '"lore": history, geography, factions, and major events — 150-250 words',
  rules: '"rules": 4-6 constraints the AI must always follow, one per line, each starting with "•"',
  tone: `"tone": exactly one of: ${VALID_TONES.join(' | ')}`,
  rating: '"rating": exactly one of: Everyone | Teen | Mature',
}

const STORY_FIELD_SPECS: Record<string, string> = {
  title: '"title": the story title',
  description: '"description": a 1-2 sentence tagline (under 240 characters)',
  opening: '"opening": the opening chapter, 130-160 words, immersive, ending at a moment of decision or tension',
  protagonistName: `"protagonistName": the protagonist's name, or an empty string if the story has no fixed protagonist — if named, ${NAME_DIVERSITY_NOTE}`,
  protagonistDesc: '"protagonistDesc": a one-line protagonist description, or an empty string if none',
  choice1: '"choice1": first path option, under 10 words',
  choice2: '"choice2": second path option, under 10 words',
  choice3: '"choice3": third path option, under 10 words',
  tags: `"tags": an array of 1-3 genre tags, each exactly one of: ${VALID_TAGS.join(', ')}`,
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name', description: 'Description', lore: 'Lore', rules: 'Rules', tone: 'Tone', rating: 'Rating',
  title: 'Title', opening: 'Opening chapter', protagonistName: 'Protagonist name',
  protagonistDesc: 'Protagonist description', choice1: 'Path 1', choice2: 'Path 2', choice3: 'Path 3', tags: 'Tags',
}

const STATIC_QUESTIONS: Record<AssistType, string[]> = {
  world: [
    'What overall tone or genre best fits this world?',
    'Who holds power, and what central conflict shapes daily life?',
    'What single rule or feature makes this world distinctive?',
  ],
  story: [
    'Who is the protagonist, and what do they want?',
    'What tone are you going for — and how dark should it get?',
    'Where does it open, and what is at stake in that first scene?',
  ],
}

// ── Model plumbing ──────────────────────────────────────────────────────────

/** Run a JSON-returning prompt through the shared text waterfall. */
async function runJSON(
  aiPrompt: string,
  userId: string,
  maxOutputTokens: number,
  feature: string,
): Promise<Record<string, unknown>> {
  const { text } = await runTextWaterfall({ prompt: aiPrompt, userId, maxOutputTokens, feature })
  return tryParseJSON(text)
}

/** A prompt-injection-guarded block carrying the idea and any clarifying answers. */
function authorBlock(subject: AssistType, prompt: string, answers: AssistAnswer[]): string {
  const answered = answers.filter((a) => a.answer.trim())
  const answerText = answered.length
    ? `\n\nClarifying answers:\n${answered.map((a) => `Q: ${a.question}\nA: ${a.answer.slice(0, 600)}`).join('\n')}`
    : ''
  return userInputBlock(`Author's ${subject} idea`, `${prompt}${answerText}`)
}

// ── Per-field normalization ─────────────────────────────────────────────────

function normalizeWorldField(key: string, value: unknown): unknown {
  switch (key) {
    case 'name': return String(value ?? '').slice(0, 80)
    case 'description': return String(value ?? '').slice(0, 240)
    case 'lore': return String(value ?? '').slice(0, 2000)
    case 'rules': return String(value ?? '').slice(0, 1000)
    case 'tone': return (VALID_TONES as readonly string[]).includes(String(value)) ? String(value) : 'Epic Fantasy'
    case 'rating':
      return (['Everyone', 'Teen', 'Mature'] as const).includes(value as ContentRating)
        ? (value as ContentRating) : 'Everyone'
    default: return String(value ?? '')
  }
}

function normalizeStoryField(key: string, value: unknown): unknown {
  switch (key) {
    case 'title': return String(value ?? '').slice(0, 100)
    case 'description': return String(value ?? '').slice(0, 240)
    case 'opening': return String(value ?? '').slice(0, 2000)
    case 'protagonistName': return String(value ?? '').slice(0, 60)
    case 'protagonistDesc': return String(value ?? '').slice(0, 200)
    case 'choice1':
    case 'choice2':
    case 'choice3': return String(value ?? '').slice(0, 80)
    case 'tags':
      return Array.isArray(value)
        ? (value as unknown[]).map(String).filter((t) => (VALID_TAGS as readonly string[]).includes(t)).slice(0, 5)
        : []
    default: return String(value ?? '')
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Ask a few short, tailored follow-up questions so generation can match intent.
 * Best-effort and cheap; falls back to a static set on any failure.
 */
export async function generateAssistQuestions(
  type: AssistType,
  prompt: string,
  worldContext: AssistWorldContext | null,
  userId: string,
): Promise<string[]> {
  const worldSection =
    type === 'story' && worldContext
      ? `The story is set in this world — tailor your questions to it:\nName: ${worldContext.name}\nDescription: ${worldContext.description}\nTone: ${worldContext.tone}\n\n`
      : ''

  const aiPrompt = `You are a thoughtful creative collaborator helping an author flesh out a ${type} idea for the Chronicle Choose Your Own Adventure platform.

Ask 3-4 SHORT, specific follow-up questions whose answers would most help you generate a ${type} that matches their intent. Make them open (not yes/no) but easy to answer in a sentence. Do not ask about anything the author already stated.

Respond with ONLY valid JSON (no markdown, no commentary): {"questions": ["...", "..."]}

${worldSection}${userInputBlock(`Author's ${type} idea`, prompt)}`

  try {
    const data = await runJSON(aiPrompt, userId, 400, `${type}-assist-questions`)
    const qs = Array.isArray(data.questions)
      ? (data.questions as unknown[]).map((q) => String(q).trim().slice(0, 220)).filter(Boolean).slice(0, 4)
      : []
    return qs.length ? qs : STATIC_QUESTIONS[type]
  } catch {
    return STATIC_QUESTIONS[type]
  }
}

/**
 * Generate (or reroll) a chosen subset of fields. Other already-filled fields are
 * supplied as context for coherence; on reroll, the current values of the target
 * fields are included with an instruction to produce a meaningfully different take.
 */
export async function generateAssistFields(opts: {
  type: AssistType
  prompt: string
  worldContext: AssistWorldContext | null
  answers: AssistAnswer[]
  fields: string[]
  current: Record<string, unknown>
  reroll: boolean
  userId: string
}): Promise<Record<string, unknown>> {
  const { type, prompt, worldContext, answers, fields, current, reroll, userId } = opts
  const specs = type === 'world' ? WORLD_FIELD_SPECS : STORY_FIELD_SPECS
  // An empty selection means "generate everything this type supports".
  const requested = (fields.length ? fields : Object.keys(specs)).filter((f) => f in specs)
  if (requested.length === 0) return {}

  const hasValue = (v: unknown) =>
    Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== ''
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v).slice(0, 600))

  const worldSection =
    type === 'story' && worldContext
      ? `World context (the story lives here — stay consistent with it):\nName: ${worldContext.name}\nDescription: ${worldContext.description}\nLore: ${worldContext.lore}\nRules: ${worldContext.rules}\nTone: ${worldContext.tone}\n\n`
      : ''

  // Other fields the author has already set — match, don't change.
  const others = Object.entries(current).filter(
    ([k, v]) => !requested.includes(k) && k in specs && hasValue(v),
  )
  const othersSection = others.length
    ? `The ${type} so far (keep these consistent — do NOT restate or change them):\n${others
        .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${fmt(v)}`)
        .join('\n')}\n\n`
    : ''

  // On reroll, show the current target values and ask for a fresh alternative.
  const rerollSection =
    reroll && requested.some((f) => hasValue(current[f]))
      ? `Provide a fresh, meaningfully DIFFERENT alternative to the current version of these field(s):\n${requested
          .filter((f) => hasValue(current[f]))
          .map((f) => `${FIELD_LABELS[f] ?? f}: ${fmt(current[f])}`)
          .join('\n')}\n\n`
      : ''

  const fieldList = requested.map((f) => `  ${specs[f]}`).join(',\n')

  const aiPrompt = `You are a creative ${type === 'world' ? 'world-builder' : 'storyteller'} for the Chronicle Choose Your Own Adventure platform.

Generate ONLY the field(s) below, matching the author's idea and any answers they gave. Respond with ONLY valid JSON (no markdown fences, no commentary) containing EXACTLY these keys:
{
${fieldList}
}

${worldSection}${othersSection}${rerollSection}${authorBlock(type, prompt, answers)}`

  const data = await runJSON(aiPrompt, userId, 1100, `${type}-assist`)

  const out: Record<string, unknown> = {}
  for (const f of requested) {
    out[f] = type === 'world' ? normalizeWorldField(f, data[f]) : normalizeStoryField(f, data[f])
  }
  return out
}
