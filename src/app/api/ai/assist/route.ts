import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateAssistQuestions, generateAssistFields } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'
import type { ContentRating } from '@/types'

const MAX_PROMPT_CHARS = 4000
const MAX_FIELD_CHARS = 4000
const MAX_ANSWER_CHARS = 1000

const AssistSchema = z.object({
  // 'questions' is a free clarifying step; 'generate'/'reroll' each cost a credit.
  mode: z.enum(['questions', 'generate', 'reroll']).default('generate'),
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt required')
    .max(MAX_PROMPT_CHARS, `Prompt is too long (max ${MAX_PROMPT_CHARS} characters).`),
  type: z.enum(['world', 'story'], { message: 'type must be "world" or "story"' }),
  // Which fields to (re)generate. Empty/absent => all generatable fields for the type.
  fields: z.array(z.string().max(40)).max(20).optional(),
  // Clarifying Q&A folded into the generation prompt.
  answers: z
    .array(
      z.object({
        question: z.string().max(300),
        answer: z.string().max(MAX_ANSWER_CHARS),
      }),
    )
    .max(8)
    .optional(),
  // The author's current field values, for coherence on partial gen / reroll.
  current: z.record(z.string(), z.unknown()).optional(),
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

/** Bound the author's current field values before they reach the model prompt. */
function sanitizeCurrent(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v.slice(0, MAX_FIELD_CHARS)
    else if (Array.isArray(v)) out[k] = v.map(String).slice(0, 10)
    else out[k] = v
  }
  return out
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
  const { mode, prompt, type, fields, answers } = parsed.data

  const worldContext = sanitizeWorldContext(parsed.data.worldContext)
  const current = sanitizeCurrent(parsed.data.current)

  // The clarifying-questions step is free: it's a short call that helps the
  // author spend their actual credit well.
  if (mode === 'questions') {
    try {
      const questions = await generateAssistQuestions(type, prompt, worldContext, uid)
      return NextResponse.json({ questions })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load questions'
      return NextResponse.json({ error: message }, { status: 503 })
    }
  }

  // generate / reroll both cost one credit (each is a fresh model generation).
  const credit = await CreditManager.consume(uid, tier, 1)
  if (!credit.success) {
    return creditFailureResponse(credit)
  }

  try {
    const result = await generateAssistFields({
      type,
      prompt,
      worldContext,
      answers: answers ?? [],
      fields: fields ?? [],
      current,
      reroll: mode === 'reroll',
      userId: uid,
    })

    trackGenerationCompleted({ kind: 'assist', credits: 1, source: credit.source, uid, context: { type, mode } })
    return NextResponse.json({ fields: result, remaining: credit.remaining })
  } catch (error) {
    await CreditManager.refund(uid, tier, 1, credit.source)
    trackGenerationFailed({ kind: 'assist', credits: 1, source: credit.source, uid, reason: 'model_error', context: { type, mode } })
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
