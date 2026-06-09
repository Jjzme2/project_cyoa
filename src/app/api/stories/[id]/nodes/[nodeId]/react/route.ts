import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { toggleNodeReaction, getNodeReactions } from '@/lib/firestore-helpers'
import type { ReactionType } from '@/types'

const VALID_REACTIONS: ReactionType[] = ['👏', '✨', '😮', '😂']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { id: storyId, nodeId } = await params

  let uid: string | null = null
  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token)
      uid = decoded.uid
    } catch {}
  }

  const reactions = await getNodeReactions(uid, storyId, nodeId)
  return NextResponse.json(reactions)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
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

  const { id: storyId, nodeId } = await params
  const { reaction } = await req.json()

  if (!VALID_REACTIONS.includes(reaction)) {
    return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
  }

  const result = await toggleNodeReaction(uid, storyId, nodeId, reaction as ReactionType)
  return NextResponse.json(result)
}
