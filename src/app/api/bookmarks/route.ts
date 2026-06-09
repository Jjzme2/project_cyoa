import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import {
  getStory,
  getUserBookmarks,
  createBookmark,
  deleteBookmark,
  isBookmarked,
  checkAndAwardAchievements,
} from '@/lib/firestore-helpers'

async function verifyUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    return await adminAuth.verifyIdToken(token)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const decoded = await verifyUser(req)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bookmarks = await getUserBookmarks(decoded.uid)
  return NextResponse.json({ bookmarks })
}

export async function POST(req: NextRequest) {
  const decoded = await verifyUser(req)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyId } = await req.json()
  if (!storyId) return NextResponse.json({ error: 'storyId required' }, { status: 400 })

  const story = await getStory(storyId)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  await createBookmark(decoded.uid, story)

  const newAchievements = await checkAndAwardAchievements(decoded.uid, 'bookmark')
  return NextResponse.json({ bookmarked: true, newAchievements }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const decoded = await verifyUser(req)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const storyId = searchParams.get('storyId')
  if (!storyId) return NextResponse.json({ error: 'storyId required' }, { status: 400 })

  await deleteBookmark(decoded.uid, storyId)
  return NextResponse.json({ bookmarked: false })
}

export async function HEAD(req: NextRequest) {
  const decoded = await verifyUser(req)
  if (!decoded) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const storyId = searchParams.get('storyId')
  if (!storyId) return NextResponse.json({ error: 'storyId required' }, { status: 400 })

  const bookmarked = await isBookmarked(decoded.uid, storyId)
  return NextResponse.json({ bookmarked })
}
