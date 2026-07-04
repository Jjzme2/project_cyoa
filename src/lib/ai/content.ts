import type { ContentRating, EndingType, StoryCharacter, StoryPathSegment, WorldBible, AmbientEffect } from '@/types'
import { VALID_TONES, VALID_TAGS, NAME_DIVERSITY_NOTE, parseAIResponse, tryParseJSON, pickStr } from './shared'
import { runTextWaterfall, isBillingOrRateLimitError } from './waterfall'
import { buildPrompt, buildSagaOpeningPrompt, userInputBlock, type WorldContext } from './prompts'

export async function generateWorldFromPrompt(
  prompt: string,
  userId: string,
): Promise<{ name: string; description: string; lore: string; rules: string; tone: string; rating: ContentRating }> {
  const aiPrompt = `You are a creative world-builder for a Choose Your Own Adventure platform called Chronicle.

Given the user's idea, generate rich world-building content.

Respond with ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "name": "evocative world name (2-5 words)",
  "description": "one-sentence hook, under 100 characters",
  "lore": "history, geography, factions, major events — 150-250 words",
  "rules": "4-6 bullet points the AI must always follow, one per line starting with •",
  "tone": "exactly one of: Epic Fantasy | Dark Horror | Sci-Fi Adventure | Cozy Mystery | High Drama | Cosmic Horror | Whimsical Fairy Tale | Gritty Noir",
  "rating": "exactly one of: Everyone | Teen | Mature"
}

${userInputBlock("User's world idea", prompt)}`

  const normalize = (data: Record<string, unknown>) => ({
    name: String(data.name ?? '').slice(0, 80),
    description: String(data.description ?? '').slice(0, 200),
    lore: String(data.lore ?? '').slice(0, 2000),
    rules: String(data.rules ?? '').slice(0, 1000),
    tone: (VALID_TONES as readonly string[]).includes(String(data.tone)) ? String(data.tone) : 'Epic Fantasy',
    rating: (['Everyone', 'Teen', 'Mature'] as const).includes(data.rating as ContentRating)
      ? (data.rating as ContentRating)
      : 'Everyone',
  })

  const { text } = await runTextWaterfall({ prompt: aiPrompt, userId, maxOutputTokens: 900, feature: 'world-assist' })
  return normalize(tryParseJSON(text))
}

export async function generateStoryFromPrompt(
  prompt: string,
  worldContext: { name: string; description: string; lore: string; rules: string; tone: string; rating?: ContentRating } | null,
  userId: string,
): Promise<{
  title: string; description: string; opening: string
  choice1: string; choice2: string; choice3: string
  protagonistName: string; protagonistDesc: string; tags: string[]
}> {
  const worldSection = worldContext
    ? `World context:\nName: ${worldContext.name}\nDescription: ${worldContext.description}\nLore: ${worldContext.lore}\nRules: ${worldContext.rules}\nTone: ${worldContext.tone}\n\n`
    : ''

  const aiPrompt = `You are a creative storyteller for a Choose Your Own Adventure platform called Chronicle.

Given the user's story idea${worldContext ? ' and its world' : ''}, generate compelling story content.

Respond with ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "title": "story title",
  "description": "one-sentence tagline under 100 characters",
  "opening": "opening chapter, 130-160 words, immersive, ends at a moment of decision or tension",
  "choice1": "first path option, under 10 words",
  "choice2": "second path option, under 10 words",
  "choice3": "third path option, under 10 words",
  "protagonistName": "protagonist name, or empty string if none",
  "protagonistDesc": "one-line protagonist description, or empty string",
  "tags": ["tag1", "tag2"]
}

If you give the protagonist a name, ${NAME_DIVERSITY_NOTE}.

tags must only include values from: Fantasy, Horror, Sci-Fi, Mystery, Romance, Adventure, Comedy, Thriller, Historical, Cosmic Horror, Fairy Tale, Noir, Post-Apocalyptic, Steampunk, Western. Pick 1-3.

${worldSection}${userInputBlock("User's story idea", prompt)}`

  const normalize = (data: Record<string, unknown>) => ({
    title: String(data.title ?? '').slice(0, 100),
    description: String(data.description ?? '').slice(0, 200),
    opening: String(data.opening ?? '').slice(0, 2000),
    choice1: String(data.choice1 ?? '').slice(0, 80),
    choice2: String(data.choice2 ?? '').slice(0, 80),
    choice3: String(data.choice3 ?? '').slice(0, 80),
    protagonistName: String(data.protagonistName ?? '').slice(0, 60),
    protagonistDesc: String(data.protagonistDesc ?? '').slice(0, 200),
    tags: Array.isArray(data.tags)
      ? (data.tags as string[]).filter((t) => (VALID_TAGS as readonly string[]).includes(t)).slice(0, 5)
      : [],
  })

  const { text } = await runTextWaterfall({ prompt: aiPrompt, userId, maxOutputTokens: 900, feature: 'story-assist' })
  return normalize(tryParseJSON(text))
}

/** Build the prompt that renders a single saga entry-point's opening chapter. */
export async function generateSagaOpening(
  world: WorldContext,
  sagaPremise: string,
  entry: { label: string; premise: string },
  userId: string,
): Promise<{ content: string; choices: string[]; model: string; newCharacters: StoryCharacter[]; location?: string; sceneAmbient?: AmbientEffect }> {
  const prompt = buildSagaOpeningPrompt(world, sagaPremise, entry)

  try {
    const { text, model } = await runTextWaterfall({ prompt, userId, maxOutputTokens: 600, feature: 'saga-opening' })
    return { ...parseAIResponse(text), model }
  } catch (error) {
    if (isBillingOrRateLimitError(error)) {
      throw new Error(
        (error as { statusCode: number }).statusCode === 402
          ? 'AI budget limit reached. Please try again later.'
          : 'Too many requests. Please slow down.',
      )
    }
    throw error
  }
}

export async function generateStoryNode(
  world: WorldContext,
  storyPath: StoryPathSegment[],
  choiceText: string,
  userId: string,
  includeImage: boolean,
  systemNarrativeEvents: string = '',
  endingDirective: string = '',
): Promise<{ content: string; choices: string[]; model: string; newCharacters: StoryCharacter[]; location?: string; sceneAmbient?: AmbientEffect; ending?: { title: string; type: EndingType } }> {
  const prompt = buildPrompt(world, storyPath, choiceText, includeImage, systemNarrativeEvents, endingDirective)

  try {
    const { text, model } = await runTextWaterfall({ prompt, userId, maxOutputTokens: 600, feature: 'story-generation' })
    return { ...parseAIResponse(text), model }
  } catch (error) {
    if (isBillingOrRateLimitError(error)) {
      throw new Error(
        (error as { statusCode: number }).statusCode === 402
          ? 'AI budget limit reached. Please try again later.'
          : 'Too many requests. Please slow down.',
      )
    }
    throw error
  }
}

export async function elaborateWorldBible(
  skeleton: WorldBible,
  world: { name: string; lore: string; rules: string; tone: string },
  userId: string,
): Promise<WorldBible> {
  const aiPrompt = `You are the loremaster for "Chronicle". Below is the STRUCTURAL SKELETON of a world's canon — regions, factions, characters, and history, already cross-referenced (rivalries, alliances, grudges). Elaborate it into vivid, coherent lore that fits the world's premise and tone.

RULES:
- PRESERVE every name and relationship exactly (regions, faction names, character names, who rivals/allies/serves whom). Do NOT rename or re-link anything.
- Only enrich the prose: region descriptions, faction founding stories, character bios, and history accounts — make them specific, logical, and evocative of the tone.
- Keep each text field to 1-2 sentences.

WORLD: ${world.name}
TONE: ${world.tone}
LORE: ${(world.lore ?? '').slice(0, 800)}
RULES: ${(world.rules ?? '').slice(0, 400)}

SKELETON (JSON):
${JSON.stringify({ regions: skeleton.regions, factions: skeleton.factions, characters: skeleton.characters, history: skeleton.history })}

Respond with ONLY valid JSON in the same shape (no markdown):
{"regions":[{"description":""}],"factions":[{"founding":""}],"characters":[{"bio":"","tie":""}],"history":[{"title":"","account":""}]}`

  const merge = (data: Record<string, unknown>): WorldBible => {
    const arr = (k: string) => (Array.isArray(data[k]) ? (data[k] as Record<string, unknown>[]) : [])
    const lr = arr('regions'), lf = arr('factions'), lc = arr('characters'), lh = arr('history')
    return {
      regions: skeleton.regions.map((r, i) => ({ ...r, description: pickStr(lr[i]?.description, r.description, 280) })),
      factions: skeleton.factions.map((f, i) => ({ ...f, founding: pickStr(lf[i]?.founding, f.founding, 280) })),
      characters: skeleton.characters.map((c, i) => ({
        ...c,
        bio: pickStr(lc[i]?.bio, c.bio, 280),
        tie: c.tie ? pickStr(lc[i]?.tie, c.tie, 220) : c.tie,
      })),
      history: skeleton.history.map((h, i) => ({
        ...h,
        title: pickStr(lh[i]?.title, h.title, 90),
        account: pickStr(lh[i]?.account, h.account, 320),
      })),
      generatedAt: skeleton.generatedAt,
    }
  }

  try {
    const { text } = await runTextWaterfall({ prompt: aiPrompt, userId, maxOutputTokens: 900, feature: 'world-genesis' })
    return merge(tryParseJSON(text))
  } catch {
    return skeleton // fail open — the procedural skeleton alone is still a usable world bible
  }
}

/**
 * A wholly custom, author-described narrative through-line (credit-gated) —
 * the same 4-beat setup/rising/turning-point/resolution shape as the curated
 * preset pools (see `plot-planner.ts`), but generated on demand instead of
 * picked from them. Persisted on the story as `customNarrativeShape` and fed
 * back into `PlotPlanner` verbatim once `narrativeMode === 'custom'`.
 */
export async function generateCustomNarrativeShape(
  description: string,
  userId: string,
): Promise<{ name: string; beats: string[] }> {
  const aiPrompt = `You are designing a custom narrative through-line — a "shape" — for a Choose Your Own Adventure story, from the author's own description of the kind of story arc they want.

A through-line has EXACTLY 4 beats, one per act: Setup, Rising action, Turning point, Resolution. Each beat is a single, concrete directorial instruction, written in the same terse, lower-case, mid-sentence imperative style as these real examples (do not reuse them, just match the register):
- "plant a subtle seed of distrust between the protagonist and someone they rely on"
- "let the compromises accumulate, each one a little easier to justify than the last"
- "reveal a truth that recontextualizes what came before"
- "spark the turn — a hard-won insight or unlikely ally"

Respond with ONLY valid JSON (no markdown fences, no explanation):
{"name": "a short evocative name for this shape (2-5 words)", "beats": ["setup beat", "rising action beat", "turning point beat", "resolution beat"]}

${userInputBlock("Author's narrative shape idea", description)}`

  const normalize = (data: Record<string, unknown>): { name: string; beats: string[] } => {
    const beatsRaw = Array.isArray(data.beats) ? (data.beats as unknown[]).map(String) : []
    const beats = beatsRaw.filter((b) => b.trim()).slice(0, 4).map((b) => b.trim().slice(0, 200))
    while (beats.length < 4) beats.push('let the through-line continue')
    return { name: pickStr(data.name, 'A Custom Shape', 60), beats }
  }

  const { text } = await runTextWaterfall({ prompt: aiPrompt, userId, maxOutputTokens: 400, feature: 'narrative-shape' })
  return normalize(tryParseJSON(text))
}

const CLASSIFIABLE_MODES = ['dramatic', 'gentle', 'dark', 'absurd', 'melancholic', 'mystery', 'slice_of_life'] as const
export type ClassifiableNarrativeMode = (typeof CLASSIFIABLE_MODES)[number]

/**
 * AI-assisted narrative-mode detection: suggests which curated mood best fits
 * an author's story premise, so they don't have to already know the mode
 * names to get a good match. A suggestion only — the author can always
 * override it in the mood picker.
 */
export async function classifyNarrativeMode(
  description: string,
  userId: string,
): Promise<ClassifiableNarrativeMode> {
  const aiPrompt = `You are classifying the narrative MOOD of a Choose Your Own Adventure story from its premise, so the story engine can pace and direct chapters in the right register.

Pick EXACTLY ONE of these moods:
- dramatic: the traditional arc — conflict, real stakes, reckonings
- gentle: no conflict at all — wonder, friendship, shared joy, no villains or danger
- dark: heavier than dramatic — dread, moral cost, no guaranteed happy ending
- absurd: surreal and comedic — illogical escalation played with total deadpan sincerity
- melancholic: quiet sorrow and bittersweet longing — memory, distance, things unsaid or lost
- mystery: a puzzle to solve — concrete clues, red herrings, a truth being chased down
- slice_of_life: ordinary and low-stakes — everyday routines, small frictions, human-scale moments

Respond with ONLY valid JSON (no markdown fences, no explanation): {"mode": "one of the exact mode names above"}

${userInputBlock('Story premise', description)}`

  const { text } = await runTextWaterfall({ prompt: aiPrompt, userId, maxOutputTokens: 60, feature: 'narrative-shape-classify' })
  const mode = String(tryParseJSON(text).mode ?? '').trim()
  return (CLASSIFIABLE_MODES as readonly string[]).includes(mode) ? (mode as ClassifiableNarrativeMode) : 'dramatic'
}
