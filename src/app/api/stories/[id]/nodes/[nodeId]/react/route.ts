import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { toggleNodeReaction, getNodeReactions } from '@/lib/firestore-helpers'

const ReactSchema = z.object({
  reaction: z.enum(['👏', '✨', '😮', '😂'], { message: 'Invalid reaction type' }),
})

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
  const parsed = await parseJson(req, ReactSchema)
  if (!parsed.ok) return parsed.response

  const result = await toggleNodeReaction(uid, storyId, nodeId, parsed.data.reaction)
  return NextResponse.json(result)
}
