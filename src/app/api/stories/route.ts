import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminAuth } from '@/lib/firebase-admin'
import { getStories, createStory, checkAndAwardAchievements } from '@/lib/firestore-helpers'
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
  const { title, description, worldId, worldName, coverGradient, resources, tags, coverTheme, readingTheme, rating } = body

  if (!title || !worldId || !worldName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const safeRating: ContentRating = CONTENT_RATINGS.includes(rating)
    ? (rating as ContentRating)
    : DEFAULT_CONTENT_RATING

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
    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
    ...(coverTheme   ? { coverTheme }   : {}),
    ...(readingTheme ? { readingTheme } : {}),
  })

  revalidateTag('stories', 'max')
  after(() => checkAndAwardAchievements(uid, 'story_created').catch(() => {}))

  return NextResponse.json({ id }, { status: 201 })
}
