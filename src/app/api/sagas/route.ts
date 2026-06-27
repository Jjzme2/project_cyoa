import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import {
  createStory,
  createSagaTree,
  getWorld,
  checkAndAwardAchievements,
} from '@/lib/firestore-helpers'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateSagaOpening, PromptRejectedError } from '@/lib/ai'
import { clampRating } from '@/lib/ratings'
import { sanitizeDirector } from '@/lib/director'
import { analytics } from '@/lib/telemetry'
import { CONTENT_RATINGS, DEFAULT_CONTENT_RATING } from '@/types'
import type { CoverTheme, ReadingTheme } from '@/types'

const MAX_ENTRY_POINTS = 4

type EntryInput = { label: string; premise: string }

const SagaSchema = z.object({
  title: z.string().trim().min(1, 'Missing required fields'),
  worldId: z.string().min(1, 'Missing required fields'),
  worldName: z.string().min(1, 'Missing required fields'),
  description: z.string().optional(),
  // Invalid/absent ratings fall back to the default, as before.
  rating: z.enum(CONTENT_RATINGS).catch(DEFAULT_CONTENT_RATING),
  tags: z.array(z.string()).optional(),
  coverTheme: z.custom<CoverTheme>().optional(),
  readingTheme: z.custom<ReadingTheme>().optional(),
  director: z.unknown().optional(),
  shared: z.boolean().optional(),
  premise: z.string().optional(),
  entryPoints: z
    .array(z.object({ label: z.string().optional(), premise: z.string().optional() }).loose())
    .optional(),
})

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  let displayName: string | null
  let tier: 'FREE' | 'PREMIUM' = 'FREE'
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
    displayName = decoded.name ?? null
    tier = (decoded.tier as 'FREE' | 'PREMIUM') ?? 'FREE'
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const parsed = await parseJson(req, SagaSchema)
  if (!parsed.ok) return parsed.response
  const {
    title,
    description,
    worldId,
    worldName,
    rating,
    tags,
    coverTheme,
    readingTheme,
    director,
    shared,
    premise,
    entryPoints,
  } = parsed.data

  // Sanitise the entry points — each is a doorway into the saga: a short label
  // the reader picks, plus a premise the AI renders the opening from.
  const entries: EntryInput[] = Array.isArray(entryPoints)
    ? entryPoints
        .map((e: { label?: string; premise?: string }) => ({
          label: typeof e?.label === 'string' ? e.label.trim().slice(0, 120) : '',
          premise: typeof e?.premise === 'string' ? e.premise.trim().slice(0, 600) : '',
        }))
        .filter((e: EntryInput) => e.label && e.premise)
        .slice(0, MAX_ENTRY_POINTS)
    : []

  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'A saga needs at least one entry point with a label and a premise.' },
      { status: 400 },
    )
  }

  const sagaPremise = typeof premise === 'string' ? premise.trim().slice(0, 1000) : ''

  // Authored director persona (optional), clamped like the story route does.
  const safeDirector = sanitizeDirector(director)

  const world = await getWorld(worldId).catch(() => null)
  if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })
  const effectiveRating = world.rating ? clampRating(rating, world.rating) : rating

  // One credit per opening we render. Reserve up front; refund on any failure.
  const cost = entries.length
  const credit = await CreditManager.consume(uid, tier, cost)
  if (!credit.success) {
    return creditFailureResponse(credit, {
      insufficientMessage: `Rendering this saga needs ${cost} credit${cost === 1 ? '' : 's'} (one per entry point). Purchase more or try again tomorrow.`,
    })
  }

  let storyId: string | null = null
  try {
    const worldCtx = {
      name: world.name,
      description: world.description,
      lore: world.lore,
      rules: world.rules,
      tone: world.tone,
      rating: effectiveRating,
      director: safeDirector ?? undefined,
      genesis: world.genesis,
    }

    // Render every entry point's opening. If any single one is rejected by the
    // model's safety pass, surface it rather than shipping a half-built saga.
    const openings = await Promise.all(
      entries.map(async (entry) => {
        const { content, choices, model, newCharacters } = await generateSagaOpening(
          worldCtx,
          sagaPremise,
          entry,
          uid,
        )
        return { label: entry.label, content, choices, aiModel: model, newCharacters }
      }),
    )

    // Seed the canon cast: the world's genesis figures plus anyone the openings
    // introduced. (Mirrors how the story route seeds from genesis.)
    const seededCast = (world.genesis?.characters ?? []).slice(0, 5).map((c) => ({
      name: c.name,
      description: [c.role, c.faction ? `of ${c.faction}` : '', c.bio].filter(Boolean).join(' · ').slice(0, 200),
      status: 'alive' as const,
    }))
    const emergent = openings.flatMap((o) => o.newCharacters ?? [])
    const seenNames = new Set(seededCast.map((c) => c.name.toLowerCase()))
    for (const c of emergent) {
      if (c.name && !seenNames.has(c.name.toLowerCase())) {
        seededCast.push({ name: c.name, description: c.description ?? '', status: 'alive' })
        seenNames.add(c.name.toLowerCase())
      }
    }

    storyId = await createStory({
      title: title.trim().slice(0, 120),
      description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
      worldId,
      worldName,
      authorId: uid,
      authorName: displayName ?? 'Anonymous',
      rootNodeId: null,
      published: true,
      coverGradient: 'from-purple-900 to-indigo-900',
      rating: effectiveRating,
      ratingOverriddenBy: null,
      resources: [],
      characters: seededCast,
      youMode: true,
      // A saga's reputation simulation depends on the social engine.
      goapEnabled: true,
      implementQuests: false,
      ...(shared === false ? { unlisted: true } : {}),
      ...(safeDirector ? { director: safeDirector } : {}),
      tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
      ...(coverTheme ? { coverTheme } : {}),
      ...(readingTheme ? { readingTheme } : {}),
    })

    const thresholdContent = buildThresholdProse(world.name, entries.length)

    await createSagaTree(
      storyId,
      thresholdContent,
      uid,
      openings.map((o) => ({ label: o.label, content: o.content, choices: o.choices, aiModel: o.aiModel })),
    )

    revalidateTag('stories', 'max')
    revalidateTag(`story-${storyId}`, 'max')
    revalidateTag(`story-tree-${storyId}`, 'max')
    after(() => checkAndAwardAchievements(uid, 'story_created').catch(() => {}))
    after(() =>
      analytics.track('saga.created', {
        uid,
        props: { storyId, worldId, rating: effectiveRating, entryPoints: entries.length },
      }),
    )

    return NextResponse.json({ id: storyId }, { status: 201 })
  } catch (error) {
    await CreditManager.refund(uid, tier, cost, credit.source).catch(() => {})
    if (error instanceof PromptRejectedError) {
      return NextResponse.json(
        { error: `An entry point was rejected: ${error.reason}` },
        { status: 422 },
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to create saga'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}

/** The short, generic framing the reader sees before choosing a doorway in. */
function buildThresholdProse(worldName: string, count: number): string {
  return `Every soul comes to ${worldName} by some road, and no two roads are alike. Yours has not yet been walked — it waits on a choice only you can make. ${
    count > 1 ? 'Before you lie several beginnings, each a different door into the same world.' : 'A single threshold stands before you.'
  } How does your story begin?`
}
