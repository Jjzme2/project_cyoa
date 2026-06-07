import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getStories, createStory } from '@/lib/firestore-helpers'

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
  const { title, description, worldId, worldName, coverGradient, resources } = body

  if (!title || !worldId || !worldName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

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
    resources: resources ?? [],
  })

  return NextResponse.json({ id }, { status: 201 })
}
