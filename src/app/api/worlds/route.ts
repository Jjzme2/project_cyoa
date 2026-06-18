import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminAuth } from '@/lib/firebase-admin'
import { createWorld, getWorldsByAuthor, checkAndAwardAchievements } from '@/lib/firestore-helpers'
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

  const id = await createWorld({
    name,
    description,
    lore,
    rules,
    tone: tone ?? 'epic fantasy',
    authorId: uid,
    authorName: displayName ?? 'Anonymous',
    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
    rating: safeRating,
    ratingOverriddenBy: null,
    ...(seed !== undefined && seed !== null ? { seed: Number(seed) } : {}),
  })

  revalidateTag('worlds', 'max')
  after(() => checkAndAwardAchievements(uid, 'world_created').catch(() => {}))

  return NextResponse.json({ id }, { status: 201 })
}
