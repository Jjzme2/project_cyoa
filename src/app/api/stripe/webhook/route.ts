import { NextRequest, NextResponse } from 'next/server'
import { StripeService, stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase-admin'
import { claimStripeEvent, markStripeEvent, releaseStripeEvent } from '@/lib/stripe-events'
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

  // Idempotency. Stripe redelivers events (retries, at-least-once delivery);
  // processing `checkout.session.completed` twice would double-credit the user
  // because addCredits() increments. Atomically claim the event id before doing
  // any work, and skip if it's already been claimed (see lib/stripe-events —
  // extracted so the money-path tests can exercise it directly).
  let claimed = false
  try {
    claimed = await claimStripeEvent(event.id, event.type)
  } catch (err) {
    // Fail closed: if we can't establish whether this event was already handled,
    // ask Stripe to retry rather than risk a double-grant.
    console.error('[Stripe Webhook] Idempotency claim failed:', err)
    return NextResponse.json({ error: 'Could not claim event' }, { status: 503 })
  }
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true })
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
            const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription
            // In the pinned API version, the billing period lives on the
            // subscription item, not the subscription itself.
            const item = subscription.items.data[0]
            const priceId = item?.price.id ?? null
            await StripeService.syncSubscriptionStatus(
              userId,
              subscription.id,
              subscription.status,
              priceId,
              item?.current_period_end ?? null
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
        const subscription = event.data.object as Stripe.Subscription
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
        const item = subscription.items.data[0]
        const priceId = item?.price.id ?? null
        await StripeService.syncSubscriptionStatus(
          userId,
          subscription.id,
          subscription.status,
          priceId,
          item?.current_period_end ?? null
        )
        break
      }

      default:
        // Unhandled event types
        break
    }

    // Mark the event fully processed so future redeliveries are skipped.
    await markStripeEvent(event.id, 'processed')
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Stripe Webhook Handler Error]:', err)
    // Release the claim so Stripe's retry can reprocess this event; otherwise a
    // transient failure would permanently skip a legitimate grant.
    await releaseStripeEvent(event.id).catch(() => {})
    return NextResponse.json(
      { error: 'Webhook event processing failed' },
      { status: 500 }
    )
  }
}
