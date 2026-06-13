import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminAuth } from '@/lib/firebase-admin'
import { getAuthContext } from '@/lib/auth'
import { moderateText, moderationToNodeFields } from '@/lib/moderation'
import { ratingRank } from '@/lib/ratings'
import { getStory, getStoryNode, createStoryNode } from '@/lib/firestore-helpers'
import { adminDb } from '@/lib/firebase-admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params
  const nodeId = req.nextUrl.searchParams.get('nodeId')
  if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })

  const auth = await getAuthContext(req)

  // Age gate: don't serve a node from a story rated above the viewer's allowance.
  const story = await getStory(storyId).catch(() => null)
  if (story && ratingRank(story.rating) > (auth?.allowedRank ?? 0)) {
    return NextResponse.json(
      { error: 'age_restricted', rating: story.rating ?? 'Mature' },
      { status: 403 },
    )
  }

  // Admins may view unpublished (flagged / rejected) routes; readers may not.
  const node = await getStoryNode(storyId, nodeId, auth?.isAdmin ?? false)
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

  // Guideline check: rating-aware — hard-refuse disallowed content, flag
  // content that exceeds the story's rating, otherwise approve.
  const verdict = moderateText(content, story.rating ?? 'Mature')
  if (verdict.action === 'refuse') {
    return NextResponse.json(
      { error: verdict.reason ?? 'This content violates the community guidelines.' },
      { status: 422 },
    )
  }
  const moderationFields = moderationToNodeFields(verdict)

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
    moderationFields,
  )

  if (!parentId) {
    await adminDb.collection('stories').doc(storyId).update({ rootNodeId: nodeId })
    revalidateTag(`story-${storyId}`, 'max')
    revalidateTag(`story-tree-${storyId}`, 'max')
  }

  return NextResponse.json({ nodeId }, { status: 201 })
}
