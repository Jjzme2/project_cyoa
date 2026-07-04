import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext, requireRegisteredAccount } from '@/lib/auth'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateCustomNarrativeShape, classifyNarrativeMode } from '@/lib/ai'
import { throttle } from '@/lib/rate-limit'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'

const ShapeSchema = z.object({
  // 'classify' is a free, throttled suggestion; 'generate' (default) is credit-gated.
  mode: z.enum(['classify', 'generate']).default('generate'),
  description: z.string().trim().min(3, 'Describe the shape you want').max(1000),
})

/**
 * `classify`: free, AI-assisted narrative-mode detection from the author's own
 * story premise — a suggestion only, throttled instead of credited since it's
 * a short, cheap call.
 * `generate`: a wholly custom, credit-gated narrative through-line — not
 * persisted here; the caller attaches the result to the story as
 * `customNarrativeShape` when it's actually created.
 */
export const POST = async (req: NextRequest) => {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guestBlock = requireRegisteredAccount(auth)
  if (guestBlock) return NextResponse.json({ error: guestBlock }, { status: 403 })

  const parsed = await parseJson(req, ShapeSchema)
  if (!parsed.ok) return parsed.response
  const { mode, description } = parsed.data

  if (mode === 'classify') {
    if (!(await throttle(`narrativeclassify:${auth.uid}`, 20, 3600))) {
      return NextResponse.json(
        { error: 'You’ve asked for a lot of mood suggestions this hour — give it a little time.' },
        { status: 429 },
      )
    }
    try {
      const detected = await classifyNarrativeMode(description, auth.uid)
      return NextResponse.json({ mode: detected })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not detect a mood'
      return NextResponse.json({ error: message }, { status: 503 })
    }
  }

  const credit = await CreditManager.consume(auth.uid, auth.tier, 1)
  if (!credit.success) return creditFailureResponse(credit)

  try {
    const shape = await generateCustomNarrativeShape(description, auth.uid)
    trackGenerationCompleted({ kind: 'assist', credits: 1, source: credit.source, uid: auth.uid, context: { feature: 'narrative-shape' } })
    return NextResponse.json({ shape, remaining: credit.remaining })
  } catch (error) {
    await CreditManager.refund(auth.uid, auth.tier, 1, credit.source)
    trackGenerationFailed({ kind: 'assist', credits: 1, source: credit.source, uid: auth.uid, reason: 'model_error', context: { feature: 'narrative-shape' } })
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
