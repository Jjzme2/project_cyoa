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
  getMultiverseEchoes,
  getLinkedEchoes,
  getMultiverseCameos,
  getLinkedCameos,
  checkAndAwardAchievements,
  getUserSagaInWorld,
} from '@/lib/firestore-helpers'
import { mergeEchoes, mergeCameos } from '@/lib/multiverse'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateSagaOpening, buildWorldContext, PromptRejectedError } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'
import { clampRating } from '@/lib/ratings'
import { sanitizeDirector } from '@/lib/director'
import { sanitizeStyleChoices } from '@/lib/story-style'
import { analytics } from '@/lib/telemetry'
import { CONTENT_RATINGS, DEFAULT_CONTENT_RATING } from '@/types'
import type { CoverTheme, ReadingTheme } from '@/types'

const MAX_ENTRY_POINTS = 4

type EntryInput = { label: string; premise: string }

const SagaSchema = z.object({
  title: z.string().trim().min(1, 'Missing required fields'),
  worldId: z.string().min(1, 'Missing required fields'),
  // Accepted for back-compat but ignored — the saga is labeled from the world we
  // load by worldId (see below), so a stale/mismatched client name can't stick.
  worldName: z.string().optional(),
  description: z.string().optional(),
  // Invalid/absent ratings fall back to the default, as before.
  rating: z.enum(CONTENT_RATINGS).catch(DEFAULT_CONTENT_RATING),
  tags: z.array(z.string()).optional(),
  coverTheme: z.custom<CoverTheme>().optional(),
  readingTheme: z.custom<ReadingTheme>().optional(),
  director: z.unknown().optional(),
  styleChoices: z.record(z.string(), z.string()).optional(),
  shared: z.boolean().optional(),
  premise: z.string().optional(),
  entryPoints: z
    .array(z.object({ label: z.string().optional(), premise: z.string().optional() }).loose())
    .optional(),
  // Canon cast carried over when spinning a saga off an existing story.
  seedCharacters: z
    .array(z.object({ name: z.string(), description: z.string().optional(), status: z.string().optional() }).loose())
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
    if (decoded.firebase?.sign_in_provider === 'anonymous') {
      return NextResponse.json({ error: 'Create a free account to start a saga.' }, { status: 403 })
    }
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
    rating,
    tags,
    coverTheme,
    readingTheme,
    director,
    styleChoices,
    shared,
    premise,
    entryPoints,
    seedCharacters,
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

  // One saga per player, per world: send them to the one they already have.
  const existingSaga = await getUserSagaInWorld(uid, worldId).catch(() => null)
  if (existingSaga) {
    return NextResponse.json(
      { error: 'You already have a saga in this world.', existingId: existingSaga.id },
      { status: 409 },
    )
  }

  const effectiveRating = world.rating ? clampRating(rating, world.rating) : rating
  // The saga's picks for the world's configurable style options.
  const safeStyleChoices = sanitizeStyleChoices(styleChoices, world.storySettings?.styleOptions)

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
    // Multiverse pool: a fresh saga carries no chronicle of its own (the reader
    // just arrived), but the WORLD's declared multiverse is canon — so its
    // sibling worlds' legends may drift in as clearly-foreign echoes.
    const [poolEchoes, linkEchoes, poolCameos, linkCameos] = await Promise.all([
      world.multiverse?.id
        ? getMultiverseEchoes(world.multiverse.id, worldId, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
      world.links?.length
        ? getLinkedEchoes(world.links, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
      world.multiverse?.id
        ? getMultiverseCameos(world.multiverse.id, worldId, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
      world.links?.length
        ? getLinkedCameos(world.links, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
    ])
    const echoes = mergeEchoes(poolEchoes, linkEchoes)
    const cameos = mergeCameos(poolCameos, linkCameos)
    // Assembled through the single audited seam: this context can only ever carry
    // THIS world's data plus the echoes/cameos its own multiverse membership opted into.
    const worldCtx = buildWorldContext(world, {
      rating: effectiveRating,
      director: safeDirector ?? undefined,
      styleChoices: safeStyleChoices ?? undefined,
      echoes,
      cameos,
    })

    // Render every entry point's opening. If any single one is rejected by the
    // model's safety pass, surface it rather than shipping a half-built saga.
    const openings = await Promise.all(
      entries.map(async (entry) => {
        const { content, choices, model, newCharacters, location, sceneAmbient } = await generateSagaOpening(
          worldCtx,
          sagaPremise,
          entry,
          uid,
        )
        return { label: entry.label, content, choices, aiModel: model, newCharacters, location, sceneAmbient }
      }),
    )

    // Seed the canon cast: the world's genesis figures plus anyone the openings
    // introduced. (Mirrors how the story route seeds from genesis.)
    const seededCast = (world.genesis?.characters ?? []).slice(0, 5).map((c) => ({
      name: c.name,
      description: [c.role, c.faction ? `of ${c.faction}` : '', c.bio].filter(Boolean).join(' · ').slice(0, 200),
      status: 'alive' as const,
    }))
    const seenNames = new Set(seededCast.map((c) => c.name.toLowerCase()))
    // Carry the cast from the source story (when spun off one), so continuity
    // holds. Genesis figures take precedence; deduped by name and bounded.
    for (const c of seedCharacters ?? []) {
      const name = typeof c?.name === 'string' ? c.name.trim().slice(0, 80) : ''
      if (name && !seenNames.has(name.toLowerCase()) && seededCast.length < 40) {
        seededCast.push({
          name,
          description: typeof c?.description === 'string' ? c.description.trim().slice(0, 200) : '',
          status: (typeof c?.status === 'string' && c.status.trim() ? c.status.trim().slice(0, 40) : 'alive') as 'alive',
        })
        seenNames.add(name.toLowerCase())
      }
    }
    const emergent = openings.flatMap((o) => o.newCharacters ?? [])
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
      // Label the saga with the world we actually loaded by worldId, never the
      // client-supplied name — a saga can't be mislabeled with a different world.
      worldName: world.name,
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
      ...(safeStyleChoices ? { styleChoices: safeStyleChoices } : {}),
      tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
      ...(coverTheme ? { coverTheme } : {}),
      ...(readingTheme ? { readingTheme } : {}),
    })

    const thresholdContent = buildThresholdProse(world.name, entries.length)

    await createSagaTree(
      storyId,
      thresholdContent,
      uid,
      openings.map((o) => ({ label: o.label, content: o.content, choices: o.choices, aiModel: o.aiModel, location: o.location, sceneAmbient: o.sceneAmbient })),
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
    trackGenerationCompleted({
      kind: 'saga',
      credits: cost,
      source: credit.source,
      uid,
      context: { worldId, entryPoints: entries.length },
    })

    return NextResponse.json({ id: storyId }, { status: 201 })
  } catch (error) {
    await CreditManager.refund(uid, tier, cost, credit.source).catch(() => {})
    const rejected = error instanceof PromptRejectedError
    trackGenerationFailed({
      kind: 'saga',
      credits: cost,
      source: credit.source,
      uid,
      reason: rejected ? 'prompt_rejected' : 'model_error',
      context: { worldId },
    })
    if (rejected) {
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
