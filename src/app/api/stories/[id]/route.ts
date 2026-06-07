import { NextRequest, NextResponse } from 'next/server'
import { getStory, getStoryNode, incrementStoryViews } from '@/lib/firestore-helpers'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [story] = await Promise.all([getStory(id), incrementStoryViews(id)])
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rootNode = story.rootNodeId ? await getStoryNode(id, story.rootNodeId) : null
  return NextResponse.json({ story, rootNode })
}
