import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { getStories, createStory, getWorld, checkAndAwardAchievements, registerCharacterAppearance } from '@/lib/firestore-helpers'
import { clampRating } from '@/lib/ratings'
import { sanitizeDirector } from '@/lib/director'
import { resolveNarrativeMode } from '@/lib/engine/narrative-mode'
import { sanitizeStyleChoices } from '@/lib/story-style'
import { analytics } from '@/lib/telemetry'
import { CONTENT_RATINGS, DEFAULT_CONTENT_RATING } from '@/types'
import type { CoverTheme, ReadingTheme, ResourceDefinition, EndingCondition } from '@/types'

// Opaque, author-supplied structures (resources, themes, director) were never
// validated field-by-field here; `z.custom`/`z.unknown` preserve that
// pass-through while the fields the handler actually reads are checked.
const CreateStorySchema = z.object({
  title: z.string().min(1),
  worldId: z.string().min(1),
  worldName: z.string().min(1),
  description: z.string().optional(),
  coverGradient: z.string().optional(),
  resources: z.custom<ResourceDefinition[]>().optional(),
  endingConditions: z.custom<EndingCondition[]>().optional(),
  narrativeMode: z.enum(['gentle', 'dramatic']).optional(),
  tags: z.array(z.string()).optional(),
  coverTheme: z.custom<CoverTheme>().optional(),
  readingTheme: z.custom<ReadingTheme>().optional(),
  // Invalid/absent ratings fall back to the default (previously a manual check).
  rating: z.enum(CONTENT_RATINGS).catch(DEFAULT_CONTENT_RATING),
  protagonist: z
    .object({ name: z.string().optional(), description: z.string().optional() })
    .loose()
    .optional(),
  director: z.unknown().optional(),
  styleChoices: z.record(z.string(), z.string()).optional(),
  youMode: z.boolean().optional(),
  shared: z.boolean().optional(),
  goapEnabled: z.boolean().optional(),
  implementQuests: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20)
  const stories = await getStories(Math.min(limit, 50))
  return NextResponse.json({ stories })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  let displayName: string | null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
    displayName = decoded.name ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const parsed = await parseJson(req, CreateStorySchema)
  if (!parsed.ok) return parsed.response
  const { title, description, worldId, worldName, coverGradient, resources, tags, coverTheme, readingTheme, rating, protagonist, director, styleChoices, youMode, shared, goapEnabled, implementQuests, endingConditions, narrativeMode } = parsed.data

  // Authored director persona (optional). Axes are clamped to [-1, 1]; only kept
  // if the author actually set something.
  const safeDirector = sanitizeDirector(director)

  // Author-defined protagonist (optional); the canon cast grows emergently.
  const protagonistName = typeof protagonist?.name === 'string' ? protagonist.name.trim().slice(0, 60) : ''
  const safeProtagonist = protagonistName
    ? {
        name: protagonistName,
        description:
          typeof protagonist?.description === 'string' ? protagonist.description.trim().slice(0, 300) : '',
      }
    : null

  // A story can never be rated more mature than the world that contains it.
  const world = await getWorld(worldId).catch(() => null)
  const safeRating = world?.rating ? clampRating(rating, world.rating) : rating
  // The story's picks for the world's configurable style options — kept only
  // when they match an offered choice.
  const safeStyleChoices = sanitizeStyleChoices(styleChoices, world?.storySettings?.styleOptions)

  // Seed the opening cast from the world's genesis canon, so stories begin
  // grounded in the world's real figures (emergent characters still grow on top).
  const seededCast = (world?.genesis?.characters ?? []).slice(0, 5).map((c) => ({
    name: c.name,
    description: [c.role, c.faction ? `of ${c.faction}` : '', c.bio].filter(Boolean).join(' · ').slice(0, 200),
    status: 'alive',
  }))

  const id = await createStory({
    title,
    description: description?.trim() || '',
    worldId,
    worldName,
    authorId: uid,
    authorName: displayName ?? 'Anonymous',
    rootNodeId: null,
    published: true,
    coverGradient: coverGradient ?? 'from-purple-900 to-indigo-900',
    rating: safeRating,
    ratingOverriddenBy: null,
    resources: resources ?? [],
    characters: seededCast,
    youMode: !!youMode,
    ...(Array.isArray(endingConditions) && endingConditions.length
      ? { endingConditions: endingConditions.slice(0, 10) }
      : {}),
    // Per-story narrative shape, CLAMPED by the world: a gentle world is law
    // (drop any override — it's implied), and 'dramatic' inside a dramatic
    // world is the default (don't store). Only a gentle story in a dramatic
    // world is a real override worth persisting.
    ...(narrativeMode === 'gentle' && resolveNarrativeMode(world ?? { tone: '', rules: '', lore: '', description: '' }) !== 'gentle'
      ? { narrativeMode: 'gentle' as const }
      : {}),
    // Default to shared/listed; only store `unlisted` when the author opts out.
    ...(shared === false ? { unlisted: true } : {}),
    // In "You" mode there's no authored protagonist — the reader is the hero.
    ...(safeProtagonist && !youMode ? { protagonist: safeProtagonist } : {}),
    ...(safeDirector ? { director: safeDirector } : {}),
    ...(safeStyleChoices ? { styleChoices: safeStyleChoices } : {}),
    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
    ...(coverTheme   ? { coverTheme }   : {}),
    ...(readingTheme ? { readingTheme } : {}),
    goapEnabled: !!goapEnabled || !!youMode, // "You" mode needs the social sim for reputation
    implementQuests: !!implementQuests,
  })

  // Promote authored characters into the first-class registry (best-effort):
  // the protagonist is the author's collectible hero; the world's seeded canon
  // figures are world-owned identities. Each records an appearance in this story.
  after(async () => {
    const appearance = { storyId: id, storyTitle: title, worldId, worldName, at: new Date().toISOString() }
    if (safeProtagonist && !youMode) {
      await registerCharacterAppearance({
        scope: 'author',
        ownerId: uid,
        name: safeProtagonist.name,
        description: safeProtagonist.description,
        tagline: 'Protagonist',
        appearance,
      }).catch(() => {})
    }
    for (const c of seededCast) {
      await registerCharacterAppearance({
        scope: 'world',
        ownerId: worldId,
        name: c.name,
        description: c.description,
        appearance,
      }).catch(() => {})
    }
    // Refresh the cached character directory + this world's cast.
    revalidateTag('characters', 'max')
  })

  revalidateTag('stories', 'max')
  after(() => checkAndAwardAchievements(uid, 'story_created').catch(() => {}))
  after(() =>
    analytics.track('story.created', {
      uid,
      props: { storyId: id, worldId, rating: safeRating, youMode: !!youMode, hasDirector: !!safeDirector },
    }),
  )

  return NextResponse.json({ id }, { status: 201 })
}
