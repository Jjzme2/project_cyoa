import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { generateWorldFromPrompt, generateStoryFromPrompt } from '@/lib/ai'
import type { ContentRating } from '@/types'

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
  const prompt: string = body.prompt ?? ''
  const type: string = body.type ?? ''
  const worldContext = body.worldContext ?? null

  if (!prompt.trim()) {
    return NextResponse.json({ error: 'Prompt required' }, { status: 400 })
  }
  if (type !== 'world' && type !== 'story') {
    return NextResponse.json({ error: 'type must be "world" or "story"' }, { status: 400 })
  }

  const credit = await CreditManager.consume(uid, tier, 1)
  if (!credit.success) {
    return NextResponse.json({ error: 'Insufficient credits', reset: credit.reset }, { status: 429 })
  }

  try {
    const result =
      type === 'world'
        ? await generateWorldFromPrompt(prompt, uid)
        : await generateStoryFromPrompt(
            prompt,
            worldContext as {
              name: string; description: string; lore: string; rules: string
              tone: string; rating?: ContentRating
            } | null,
            uid,
          )

    return NextResponse.json({ ...result, remaining: credit.remaining })
  } catch (error) {
    await CreditManager.refund(uid, tier, 1, credit.source)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
