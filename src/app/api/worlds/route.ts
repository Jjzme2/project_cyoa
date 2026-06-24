import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminAuth } from '@/lib/firebase-admin'
import { createWorld, getWorldsByAuthor, checkAndAwardAchievements, setWorldGenesis } from '@/lib/firestore-helpers'
import { buildGenesisSkeleton } from '@/lib/engine/world-genesis'
import { SeededRNG } from '@/lib/engine/seed-rng'
import { elaborateWorldBible } from '@/lib/ai'
import { CONTENT_RATINGS, DEFAULT_CONTENT_RATING } from '@/types'
import type { ContentRating } from '@/types'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const worlds = await getWorldsByAuthor(uid)
  return NextResponse.json({ worlds })
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
  const { name, description, lore, rules, tone, tags, rating, seed } = body

  if (!name || !description || !lore || !rules) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const safeRating: ContentRating = CONTENT_RATINGS.includes(rating)
    ? (rating as ContentRating)
    : DEFAULT_CONTENT_RATING

  const effectiveTone = tone ?? 'Epic Fantasy'
  // Every world gets a stable seed, so its genesis + simulation are reproducible.
  const effectiveSeed = seed !== undefined && seed !== null ? Number(seed) : SeededRNG.hashString(name)

  const id = await createWorld({
    name,
    description,
    lore,
    rules,
    tone: effectiveTone,
    authorId: uid,
    authorName: displayName ?? 'Anonymous',
    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
    rating: safeRating,
    ratingOverriddenBy: null,
    seed: effectiveSeed,
  })

  revalidateTag('worlds', 'max')

  after(async () => {
    await checkAndAwardAchievements(uid, 'world_created').catch(() => {})
    // Procedural world genesis: a seeded, cross-referenced canon skeleton,
    // elaborated by one LLM call, persisted as the world's bible.
    try {
      const skeleton = buildGenesisSkeleton(effectiveSeed, effectiveTone)
      const bible = await elaborateWorldBible(skeleton, { name, lore, rules, tone: effectiveTone }, uid)
      await setWorldGenesis(id, bible)
      revalidateTag(`world-${id}`, 'max')
    } catch (e) {
      console.error('[world genesis] failed:', e)
    }
  })

  return NextResponse.json({ id }, { status: 201 })
}
