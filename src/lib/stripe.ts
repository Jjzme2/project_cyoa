import Stripe from 'stripe'
import { adminAuth, adminDb } from './firebase-admin'
import { CreditManager } from './credit-manager'
import { computeStripeMocked } from './stripe-mode'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || ''
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const keyLooksReal = !!stripeSecretKey && !stripeSecretKey.includes('placeholder')

/**
 * Developer "mock" checkout — which grants credits / PREMIUM with NO real charge
 * — is ONLY ever available OUTSIDE production (see `stripe-mode.ts`). Gated on
 * the environment, not just the key: in production the app always talks to real
 * Stripe, and if the key is missing there, payments fail cleanly rather than
 * silently minting credits. Without this gate, an unset key in prod would drop
 * the app into mock mode where any signed-in user could self-grant unlimited
 * credits via `mock_checkout`.
 */
export const isStripeMocked = computeStripeMocked(process.env.NODE_ENV, process.env.STRIPE_SECRET_KEY)

// A real key initializes the live client regardless of environment; a missing
// key leaves it null (payment routes then fail cleanly instead of minting).
export const stripe = keyLooksReal
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2026-05-27.dahlia',
    })
  : null

/**
 * Stripe Billing & Payment Service
 * Declares all imports/constants at the absolute top of the file.
 */
export class StripeService {
  /**
   * Creates a checkout session for purchasing credits or starting a subscription.
   */
  public static async createCheckoutSession(params: {
    userId: string
    email: string | null
    type: 'subscription' | 'credits'
    priceId: string
    creditsAmount?: number
  }): Promise<{ url: string; isMock: boolean }> {
    if (isStripeMocked) {
      // Return a local mock success redirect URL for developer preview
      const query = new URLSearchParams({
        mock_checkout: 'success',
        type: params.type,
        priceId: params.priceId,
        credits: String(params.creditsAmount ?? 0),
        userId: params.userId,
      })
      return {
        url: `${appUrl}/profile?${query.toString()}`,
        isMock: true,
      }
    }

    if (!stripe) {
      // Production with no key configured — fail cleanly (never mint).
      throw new Error('Payments are not configured. Please try again later.')
    }

    // Find or create customer
    const userSettingsRef = adminDb.collection('userSettings').doc(params.userId)
    const settingsSnap = await userSettingsRef.get()
    let customerId = settingsSnap.exists ? settingsSnap.data()?.stripeCustomerId : null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: params.email || undefined,
        metadata: { userId: params.userId },
      })
      customerId = customer.id
      await userSettingsRef.set({ stripeCustomerId: customerId }, { merge: true })
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: params.type === 'subscription' ? 'subscription' : 'payment',
      allow_promotion_codes: true, // Ability to apply coupon codes
      success_url: `${appUrl}/profile?checkout_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/profile?checkout_status=canceled`,
      metadata: {
        userId: params.userId,
        type: params.type,
        creditsAmount: String(params.creditsAmount ?? 0),
      },
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return { url: session.url!, isMock: false }
  }

  /**
   * Generates a Customer Portal link for managing subscriptions.
   */
  public static async createPortalSession(userId: string): Promise<string> {
    const userSettingsRef = adminDb.collection('userSettings').doc(userId)
    const settingsSnap = await userSettingsRef.get()
    const customerId = settingsSnap.exists ? settingsSnap.data()?.stripeCustomerId : null

    if (isStripeMocked || !customerId) {
      return `${appUrl}/profile?mock_portal=1`
    }

    if (!stripe) {
      throw new Error('Stripe client not initialized')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/profile`,
    })

    return session.url
  }

  /**
   * Syncs the user's subscription status from Stripe to Firestore and Firebase Auth Claims.
   */
  public static async syncSubscriptionStatus(
    userId: string,
    stripeSubscriptionId: string | null,
    status: string | null,
    priceId: string | null,
    periodEnd: number | null
  ) {
    const isPremiumActive = status === 'active' || status === 'trialing'
    const tier = isPremiumActive ? 'PREMIUM' : 'FREE'
    const periodEndIso = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

    // Update custom claim in Firebase Auth for secure JWT validation
    try {
      await adminAuth.setCustomUserClaims(userId, { tier })
    } catch (err) {
      console.error(`[StripeService.syncSubscriptionStatus] Failed to set claims for ${userId}:`, err)
    }

    // Update Firestore User Profile settings
    const userSettingsRef = adminDb.collection('userSettings').doc(userId)
    await userSettingsRef.set(
      {
        tier,
        stripeSubscriptionId,
        subscriptionStatus: status,
        stripePriceId: priceId,
        subscriptionPeriodEnd: periodEndIso,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
  }

  /**
   * Syncs custom mock checkout (developer sandbox mode).
   */
  public static async processMockCheckout(params: {
    userId: string
    type: 'subscription' | 'credits'
    creditsAmount: number
  }) {
    // Hard stop: mock grants must never run in production, even if some caller
    // forgets the `isStripeMocked` guard. Belt-and-suspenders around the
    // environment gate in this module's header.
    if (!isStripeMocked) {
      throw new Error('Mock checkout is not available in this environment.')
    }
    if (params.type === 'subscription') {
      await this.syncSubscriptionStatus(
        params.userId,
        'sub_mock_active',
        'active',
        'price_premium_mock',
        Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
      )
    } else if (params.type === 'credits') {
      await CreditManager.addCredits(params.userId, params.creditsAmount)
    }
  }
}
