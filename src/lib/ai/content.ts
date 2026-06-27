import { generateText, APICallError } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { ContentRating, StoryCharacter, StoryPathSegment, WorldBible } from '@/types'
import { PRIMARY_MODEL, OPENROUTER_MODEL, VALID_TONES, VALID_TAGS, parseAIResponse, tryParseJSON, pickStr } from './shared'
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

  try {
    const result = await generateText({
      model: PRIMARY_MODEL,
      prompt: aiPrompt,
      maxOutputTokens: 900,
      providerOptions: { gateway: { user: userId, tags: ['feature:world-assist', 'env:production'] } },
    })
    return normalize(tryParseJSON(result.text))
  } catch (error) {
    if (APICallError.isInstance(error) && (error.statusCode === 402 || error.statusCode === 429)) throw error
    if (!process.env.OPENROUTER_API_KEY) throw error
    const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })
    const result = await generateText({ model: openrouter(OPENROUTER_MODEL), prompt: aiPrompt, maxOutputTokens: 900 })
    return normalize(tryParseJSON(result.text))
  }
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

  try {
    const result = await generateText({
      model: PRIMARY_MODEL,
      prompt: aiPrompt,
      maxOutputTokens: 900,
      providerOptions: { gateway: { user: userId, tags: ['feature:story-assist', 'env:production'] } },
    })
    return normalize(tryParseJSON(result.text))
  } catch (error) {
    if (APICallError.isInstance(error) && (error.statusCode === 402 || error.statusCode === 429)) throw error
    if (!process.env.OPENROUTER_API_KEY) throw error
    const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })
    const result = await generateText({ model: openrouter(OPENROUTER_MODEL), prompt: aiPrompt, maxOutputTokens: 900 })
    return normalize(tryParseJSON(result.text))
  }
}

/** Build the prompt that renders a single saga entry-point's opening chapter. */
export async function generateSagaOpening(
  world: WorldContext,
  sagaPremise: string,
  entry: { label: string; premise: string },
  userId: string,
): Promise<{ content: string; choices: string[]; model: string; newCharacters: StoryCharacter[] }> {
  const prompt = buildSagaOpeningPrompt(world, sagaPremise, entry)

  try {
    const result = await generateText({
      model: PRIMARY_MODEL,
      prompt,
      maxOutputTokens: 600,
      providerOptions: { gateway: { user: userId, tags: ['feature:saga-opening', 'env:production'] } },
    })
    return { ...parseAIResponse(result.text), model: PRIMARY_MODEL }
  } catch (error) {
    if (APICallError.isInstance(error) && error.statusCode === 402) {
      throw new Error('AI budget limit reached. Please try again later.')
    }
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      throw new Error('Too many requests. Please slow down.')
    }
    if (!process.env.OPENROUTER_API_KEY) throw error
    const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })
    const result = await generateText({ model: openrouter(OPENROUTER_MODEL), prompt, maxOutputTokens: 600 })
    return { ...parseAIResponse(result.text), model: `openrouter/${OPENROUTER_MODEL}` }
  }
}

export async function generateStoryNode(
  world: WorldContext,
  storyPath: StoryPathSegment[],
  choiceText: string,
  userId: string,
  includeImage: boolean,
  systemNarrativeEvents: string = '',
): Promise<{ content: string; choices: string[]; model: string; newCharacters: StoryCharacter[] }> {
  const prompt = buildPrompt(world, storyPath, choiceText, includeImage, systemNarrativeEvents)

  try {
    const result = await generateText({
      model: PRIMARY_MODEL,
      prompt,
      maxOutputTokens: 600,
      providerOptions: {
        gateway: {
          user: userId,
          tags: ['feature:story-generation', 'env:production'],
        },
      },
    })
    const parsed = parseAIResponse(result.text)
    return { ...parsed, model: PRIMARY_MODEL }
  } catch (error) {
    if (APICallError.isInstance(error) && error.statusCode === 402) {
      throw new Error('AI budget limit reached. Please try again later.')
    }
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      throw new Error('Too many requests. Please slow down.')
    }

    if (!process.env.OPENROUTER_API_KEY) throw error

    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    })
    const result = await generateText({
      model: openrouter(OPENROUTER_MODEL),
      prompt,
      maxOutputTokens: 600,
    })
    const parsed = parseAIResponse(result.text)
    return { ...parsed, model: `openrouter/${OPENROUTER_MODEL}` }
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
    const result = await generateText({
      model: PRIMARY_MODEL,
      prompt: aiPrompt,
      maxOutputTokens: 900,
      providerOptions: { gateway: { user: userId, tags: ['feature:world-genesis', 'env:production'] } },
    })
    return merge(tryParseJSON(result.text))
  } catch (error) {
    if (APICallError.isInstance(error) && (error.statusCode === 402 || error.statusCode === 429)) return skeleton
    if (!process.env.OPENROUTER_API_KEY) return skeleton
    try {
      const openrouter = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })
      const result = await generateText({ model: openrouter(OPENROUTER_MODEL), prompt: aiPrompt, maxOutputTokens: 900 })
      return merge(tryParseJSON(result.text))
    } catch {
      return skeleton
    }
  }
}
