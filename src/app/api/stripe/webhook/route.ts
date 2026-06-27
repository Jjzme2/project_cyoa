import { NextRequest, NextResponse } from 'next/server'
import { StripeService, stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { analytics, insights } from '@/lib/telemetry'
import type Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

/**
 * Stripe Webhook Receiver Endpoint
 * Declares all imports/constants at the absolute top of the file.
 */
export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is disabled or mocked' }, { status: 400 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !webhookSecret) {
    console.warn('[Stripe Webhook] Missing signature or webhook secret configuration.')
    return NextResponse.json({ error: 'Config error or missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown signature error'
    console.error(`[Stripe Webhook] Signature verification failed: ${msg}`)
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata || {}
        const userId = metadata.userId
        const type = metadata.type
        const creditsAmount = Number(metadata.creditsAmount || 0)

        if (!userId) {
          console.error('[Stripe Webhook] No userId found in session metadata')
          break
        }

        if (type === 'subscription') {
          const subscriptionId = session.subscription as string
          if (subscriptionId) {
            const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any
            const priceId = subscription.items.data[0]?.price.id ?? null
            await StripeService.syncSubscriptionStatus(
              userId,
              subscription.id,
              subscription.status,
              priceId,
              subscription.current_period_end
            )
          }
          await insights.track('subscription.checkout', { uid: userId, props: { type } })
        } else if (type === 'credits' && creditsAmount > 0) {
          await CreditManager.addCredits(userId, creditsAmount)
          await analytics.track('purchase.completed', { uid: userId, props: { credits: creditsAmount } })
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any
        const customerId = subscription.customer as string

        // Find the user mapped to this Stripe customer ID in our flattened Firestore schema
        const snap = await adminDb
          .collection('userSettings')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get()

        if (snap.empty) {
          console.error(`[Stripe Webhook] No user found for customer ID ${customerId}`)
          break
        }

        const userId = snap.docs[0].id
        const priceId = subscription.items.data[0]?.price.id ?? null
        await StripeService.syncSubscriptionStatus(
          userId,
          subscription.id,
          subscription.status,
          priceId,
          subscription.current_period_end
        )
        break
      }

      default:
        // Unhandled event types
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Stripe Webhook Handler Error]:', err)
    return NextResponse.json(
      { error: 'Webhook event processing failed' },
      { status: 500 }
    )
  }
}
