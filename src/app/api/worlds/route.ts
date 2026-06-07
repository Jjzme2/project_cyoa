import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { createWorld, getWorldsByAuthor } from '@/lib/firestore-helpers'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const worlds = await getWorldsByAuthor(uid)
  return NextResponse.json({ worlds })
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
  const { name, description, lore, rules, tone } = body

  if (!name || !description || !lore || !rules) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const id = await createWorld({
    name,
    description,
    lore,
    rules,
    tone: tone ?? 'epic fantasy',
    authorId: uid,
    authorName: displayName ?? 'Anonymous',
  })

  return NextResponse.json({ id }, { status: 201 })
}
