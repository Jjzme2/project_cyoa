import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getReadingProgress, saveReadingProgress } from '@/lib/firestore-helpers'

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyId } = await params
  const progress = await getReadingProgress(uid, storyId)
  return NextResponse.json(progress ?? { currentNodeId: null, nodeHistory: [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storyId } = await params
  const { currentNodeId, nodeHistory } = await req.json()
  if (!currentNodeId || !Array.isArray(nodeHistory)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await saveReadingProgress(uid, storyId, currentNodeId, nodeHistory)
  return NextResponse.json({ ok: true })
}
