import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateCoverImage } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'
import { sanitizeDirector, describeDirectorForCoverArt } from '@/lib/director'

const CoverImageSchema = z.object({
  title: z.string().trim().min(1, 'title required'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  worldName: z.string().optional(),
  worldDescription: z.string().optional(),
  director: z.unknown().optional(),
})

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  let tier: 'FREE' | 'PREMIUM' = 'FREE'
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.firebase?.sign_in_provider === 'anonymous') {
      return NextResponse.json({ error: 'Create a free account to use AI features.' }, { status: 403 })
    }
    uid = decoded.uid
    tier = (decoded.tier as 'FREE' | 'PREMIUM') ?? 'FREE'
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const parsed = await parseJson(req, CoverImageSchema)
  if (!parsed.ok) return parsed.response
  const { title, description, tags, worldName, worldDescription, director } = parsed.data
  const directorNotes = describeDirectorForCoverArt(sanitizeDirector(director))

  const credit = await CreditManager.consume(uid, tier, 3)
  if (!credit.success) {
    return creditFailureResponse(credit)
  }

  const blobKey = `${uid}-${Date.now()}`
  const result = await generateCoverImage(
    title,
    description ?? '',
    tags ?? [],
    worldName ?? '',
    worldDescription ?? '',
    blobKey,
    directorNotes,
  )

  if (!result.url) {
    await CreditManager.refund(uid, tier, 3, credit.source)
    trackGenerationFailed({ kind: 'cover', credits: 3, source: credit.source, uid, reason: 'image_failed' })
    return NextResponse.json({ error: result.error ?? 'Generation failed' }, { status: 503 })
  }

  trackGenerationCompleted({ kind: 'cover', credits: 3, source: credit.source, uid })
  return NextResponse.json({ url: result.url, remaining: credit.remaining })
}
