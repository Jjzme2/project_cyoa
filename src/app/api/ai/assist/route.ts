import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateWorldFromPrompt, generateStoryFromPrompt } from '@/lib/ai'
import type { ContentRating } from '@/types'

const MAX_PROMPT_CHARS = 4000
const MAX_FIELD_CHARS = 4000

const AssistSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt required')
    .max(MAX_PROMPT_CHARS, `Prompt is too long (max ${MAX_PROMPT_CHARS} characters).`),
  type: z.enum(['world', 'story'], { message: 'type must be "world" or "story"' }),
  // Untrusted; bounded by sanitizeWorldContext below.
  worldContext: z.unknown().optional(),
})

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

  // Bound input before it ever reaches the model: a huge prompt still costs a
  // credit and widens the prompt-injection surface (enforced by AssistSchema).
  const parsed = await parseJson(req, AssistSchema)
  if (!parsed.ok) return parsed.response
  const { prompt, type } = parsed.data

  const worldContext = sanitizeWorldContext(parsed.data.worldContext)

  const credit = await CreditManager.consume(uid, tier, 1)
  if (!credit.success) {
    return creditFailureResponse(credit)
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
