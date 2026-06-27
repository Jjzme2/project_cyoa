import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { generateWorldFromPrompt, generateStoryFromPrompt } from '@/lib/ai'
import type { ContentRating } from '@/types'

const MAX_PROMPT_CHARS = 4000
const MAX_FIELD_CHARS = 4000

type WorldContext = {
  name: string; description: string; lore: string; rules: string
  tone: string; rating?: ContentRating
}

/** Coerce an untrusted worldContext into a known, length-bounded shape (or null). */
function sanitizeWorldContext(input: unknown): WorldContext | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_FIELD_CHARS) : '')
  const rating = raw.rating
  return {
    name: str(raw.name),
    description: str(raw.description),
    lore: str(raw.lore),
    rules: str(raw.rules),
    tone: str(raw.tone),
    rating: (['Everyone', 'Teen', 'Mature'] as const).includes(rating as ContentRating)
      ? (rating as ContentRating)
      : undefined,
  }
}

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

  let body: { prompt?: unknown; type?: unknown; worldContext?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const type = typeof body.type === 'string' ? body.type : ''

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt required' }, { status: 400 })
  }
  // Bound input before it ever reaches the model: a huge prompt still costs a
  // credit and widens the prompt-injection surface.
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: `Prompt is too long (max ${MAX_PROMPT_CHARS} characters).` },
      { status: 400 },
    )
  }
  if (type !== 'world' && type !== 'story') {
    return NextResponse.json({ error: 'type must be "world" or "story"' }, { status: 400 })
  }

  const worldContext = sanitizeWorldContext(body.worldContext)

  const credit = await CreditManager.consume(uid, tier, 1)
  if (!credit.success) {
    return NextResponse.json({ error: 'Insufficient credits', reset: credit.reset }, { status: 429 })
  }

  try {
    const result =
      type === 'world'
        ? await generateWorldFromPrompt(prompt, uid)
        : await generateStoryFromPrompt(prompt, worldContext, uid)

    return NextResponse.json({ ...result, remaining: credit.remaining })
  } catch (error) {
    await CreditManager.refund(uid, tier, 1, credit.source)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
