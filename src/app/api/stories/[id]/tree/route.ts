import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getStory, getStoryTree } from '@/lib/firestore-helpers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { id: storyId } = await params
  const story = await getStory(storyId)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  if (story.authorId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tree = await getStoryTree(storyId)
  return NextResponse.json({ tree })
}
