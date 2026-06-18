import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { generateCoverImage } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  let tier: 'FREE' | 'PREMIUM' = 'FREE'
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
    tier = (decoded.tier as 'FREE' | 'PREMIUM') ?? 'FREE'
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = await req.json()
  const { title, description, tags, worldName, worldDescription } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const credit = await CreditManager.consume(uid, tier, 3)
  if (!credit.success) {
    return NextResponse.json({ error: 'Insufficient credits', reset: credit.reset }, { status: 429 })
  }

  const blobKey = `${uid}-${Date.now()}`
  const result = await generateCoverImage(
    title,
    description ?? '',
    tags ?? [],
    worldName ?? '',
    worldDescription ?? '',
    blobKey,
  )

  if (!result.url) {
    await CreditManager.refund(uid, tier, 3, credit.source)
    return NextResponse.json({ error: result.error ?? 'Generation failed' }, { status: 503 })
  }

  return NextResponse.json({ url: result.url, remaining: credit.remaining })
}
