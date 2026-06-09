import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminAuth } from '@/lib/firebase-admin'
import { getStory, getStoryNode, createStoryNode } from '@/lib/firestore-helpers'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params
  const nodeId = req.nextUrl.searchParams.get('nodeId')
  if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })

  const node = await getStoryNode(storyId, nodeId)
  if (!node || node.storyId !== storyId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ node })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params
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

  const story = await getStory(storyId)
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  const body = await req.json()
  const { content, depth, parentId, choiceText, aiGenerated, aiModel, choices } = body

  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const nodeId = await createStoryNode(
    {
      storyId,
      content,
      depth: depth ?? 0,
      parentId: parentId ?? null,
      choiceText: choiceText ?? null,
      authorId: uid,
      aiGenerated: aiGenerated ?? false,
      aiModel: aiModel ?? null,
      imageUrl: null,
    },
    choices ?? [],
  )

  if (!parentId) {
    await adminDb.collection('stories').doc(storyId).update({ rootNodeId: nodeId })
    revalidateTag(`story-${storyId}`, 'max')
    revalidateTag(`story-tree-${storyId}`, 'max')
  }

  return NextResponse.json({ nodeId }, { status: 201 })
}
