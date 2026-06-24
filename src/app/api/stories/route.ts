import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminAuth } from '@/lib/firebase-admin'
import { getStories, createStory, getWorld, checkAndAwardAchievements } from '@/lib/firestore-helpers'
import { clampRating } from '@/lib/ratings'
import { CONTENT_RATINGS, DEFAULT_CONTENT_RATING } from '@/types'
import type { ContentRating } from '@/types'

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

  const body = await req.json()
  const { title, description, worldId, worldName, coverGradient, resources, tags, coverTheme, readingTheme, rating, protagonist, director, youMode, shared, goapEnabled, implementQuests } = body

  if (!title || !worldId || !worldName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Authored director persona (optional). Axes are clamped to [-1, 1]; only kept
  // if the author actually set something.
  const clampAxis = (v: unknown) => Math.max(-1, Math.min(1, Number(v) || 0))
  const safeDirector =
    director && typeof director === 'object'
      ? (() => {
          const d = {
            experimental: clampAxis(director.experimental),
            intensity: clampAxis(director.intensity),
            darkness: clampAxis(director.darkness),
            pace: clampAxis(director.pace),
            vision: typeof director.vision === 'string' ? director.vision.trim().slice(0, 300) : '',
          }
          const meaningful = d.experimental || d.intensity || d.darkness || d.pace || d.vision
          return meaningful ? d : null
        })()
      : null

  // Author-defined protagonist (optional); the canon cast grows emergently.
  const protagonistName = typeof protagonist?.name === 'string' ? protagonist.name.trim().slice(0, 60) : ''
  const safeProtagonist = protagonistName
    ? {
        name: protagonistName,
        description:
          typeof protagonist?.description === 'string' ? protagonist.description.trim().slice(0, 300) : '',
      }
    : null

  const requestedRating: ContentRating = CONTENT_RATINGS.includes(rating)
    ? (rating as ContentRating)
    : DEFAULT_CONTENT_RATING

  // A story can never be rated more mature than the world that contains it.
  const world = await getWorld(worldId).catch(() => null)
  const safeRating = world?.rating ? clampRating(requestedRating, world.rating) : requestedRating

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
    // Default to shared/listed; only store `unlisted` when the author opts out.
    ...(shared === false ? { unlisted: true } : {}),
    // In "You" mode there's no authored protagonist — the reader is the hero.
    ...(safeProtagonist && !youMode ? { protagonist: safeProtagonist } : {}),
    ...(safeDirector ? { director: safeDirector } : {}),
    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
    ...(coverTheme   ? { coverTheme }   : {}),
    ...(readingTheme ? { readingTheme } : {}),
    goapEnabled: !!goapEnabled || !!youMode, // "You" mode needs the social sim for reputation
    implementQuests: !!implementQuests,
  })

  revalidateTag('stories', 'max')
  after(() => checkAndAwardAchievements(uid, 'story_created').catch(() => {}))

  return NextResponse.json({ id }, { status: 201 })
}
