import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext, requireRegisteredAccount } from '@/lib/auth'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateCustomNarrativeShape } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'

const ShapeSchema = z.object({
  description: z.string().trim().min(3, 'Describe the shape you want').max(1000),
})

/**
 * Generate a wholly custom, credit-gated narrative through-line from the
 * author's own description — not persisted here; the caller attaches the
 * result to the story as `customNarrativeShape` when it's actually created.
 */
export const POST = async (req: NextRequest) => {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guestBlock = requireRegisteredAccount(auth)
  if (guestBlock) return NextResponse.json({ error: guestBlock }, { status: 403 })

  const parsed = await parseJson(req, ShapeSchema)
  if (!parsed.ok) return parsed.response
  const { description } = parsed.data

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
