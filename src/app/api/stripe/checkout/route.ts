import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { StripeService } from '@/lib/stripe'
import { APP_CONFIG } from '@/lib/config'

const CheckoutSchema = z.object({
  type: z.enum(['subscription', 'credits'], { message: 'Invalid checkout type' }),
  packageId: z.string().optional(),
})

/**
 * Stripe Checkout Session Endpoint
 * Declares all imports/constants at the absolute top of the file.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let uid: string
  let email: string | null = null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
    email = decoded.email ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
  }

  const parsed = await parseJson(req, CheckoutSchema)
  if (!parsed.ok) return parsed.response
  const { type, packageId } = parsed.data

  try {
    let priceId = ''
    let creditsAmount = 0

    if (type === 'subscription') {
      priceId = APP_CONFIG.stripe.premiumPriceId
    } else {
      const pkg = APP_CONFIG.stripe.creditPackages.find(p => p.id === packageId)
      if (!pkg) {
        return NextResponse.json({ error: 'Invalid credit package selected' }, { status: 400 })
      }
      priceId = pkg.priceId
      creditsAmount = pkg.credits
    }

    const session = await StripeService.createCheckoutSession({
      userId: uid,
      email,
      type,
      priceId,
      creditsAmount,
    })

    return NextResponse.json({ url: session.url, isMock: session.isMock })
  } catch (err) {
    console.error('[Stripe Checkout Route Error]:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
