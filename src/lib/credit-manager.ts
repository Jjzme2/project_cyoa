import { adminDb } from './firebase-admin'
import { checkRateLimit, refundRateLimit } from './rate-limit'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * Credit Manager
 * Integrates daily AI rate limits (Redis) with purchased credit balances (Firestore).
 * Declares all imports/constants at the absolute top of the file.
 */
export class CreditManager {
  /**
   * Consumes credits for a user.
   * First attempts to consume from daily rate limit. If daily limit is exhausted,
   * consumes from purchased credit balance in user settings Firestore document.
   */
  public static async consume(
    userId: string,
    tier: 'FREE' | 'PREMIUM',
    amount: number
  ): Promise<{ success: boolean; remaining: number; reset: number; source: 'daily' | 'purchased' }> {
    // 1. Try checking daily rate limit first
    const dailyResult = await checkRateLimit(userId, tier, amount)
    if (dailyResult.success) {
      return {
        success: true,
        remaining: dailyResult.remaining,
        reset: dailyResult.reset,
        source: 'daily',
      }
    }

    if (dailyResult.degraded) {
      // Rate limiter is down (fails closed). We won't grant a free generation;
      // fall through to purchased credits so paying users keep working, and
      // deny if they have none.
      console.warn('[CreditManager] rate limiter degraded — falling back to purchased credits only')
    }

    // 2. Daily limit exhausted (or unavailable). Check purchased credits in Firestore
    const userSettingsRef = adminDb.collection('userSettings').doc(userId)
    
    try {
      let success = false
      let purchasedRemaining = 0

      await adminDb.runTransaction(async (txn) => {
        const doc = await txn.get(userSettingsRef)
        const data = doc.exists ? doc.data()! : {}
        const currentCredits = data.purchasedCredits ?? 0

        if (currentCredits >= amount) {
          success = true
          purchasedRemaining = currentCredits - amount
          txn.set(
            userSettingsRef,
            { 
              purchasedCredits: FieldValue.increment(-amount),
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          )
        } else {
          purchasedRemaining = currentCredits
        }
      })

      // Refund the daily rate limit count since we didn't use daily credits
      await refundRateLimit(userId, tier, amount)

      if (success) {
        return {
          success: true,
          remaining: purchasedRemaining,
          reset: dailyResult.reset,
          source: 'purchased',
        }
      }
    } catch (err) {
      console.error('[CreditManager.consume] Transaction failed:', err)
    }

    return {
      success: false,
      remaining: 0,
      reset: dailyResult.reset,
      source: 'daily',
    }
  }

  /**
   * Gets the total credits info for a user (daily + purchased).
   */
  public static async getCreditsInfo(
    userId: string,
    tier: 'FREE' | 'PREMIUM'
  ): Promise<{
    dailyRemaining: number;
    dailyLimit: number;
    purchasedCredits: number;
    totalRemaining: number;
    reset: number;
  }> {
    const userSettingsRef = adminDb.collection('userSettings').doc(userId)
    
    // Fetch daily uses and purchased credits in parallel
    const [dailyInfo, settingsSnap] = await Promise.all([
      import('./rate-limit').then(m => m.getRemainingUses(userId, tier)),
      userSettingsRef.get(),
    ])

    const purchasedCredits = settingsSnap.exists
      ? (settingsSnap.data()?.purchasedCredits ?? 0)
      : 0

    return {
      dailyRemaining: dailyInfo.remaining,
      dailyLimit: dailyInfo.limit,
      purchasedCredits,
      totalRemaining: dailyInfo.remaining + purchasedCredits,
      reset: dailyInfo.reset,
    }
  }

  /**
   * Adds credits to a user's balance in Firestore.
   */
  public static async addCredits(userId: string, amount: number) {
    const userSettingsRef = adminDb.collection('userSettings').doc(userId)
    await userSettingsRef.set(
      {
        purchasedCredits: FieldValue.increment(amount),
        lifetimeCreditsPurchased: FieldValue.increment(amount),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
  }

  /**
   * Sets a user's purchased-credit balance to an exact amount (admin override).
   * Returns the new balance. Negative inputs are floored to zero.
   */
  public static async setPurchasedCredits(userId: string, amount: number): Promise<number> {
    const next = Math.max(0, Math.floor(amount))
    await adminDb.collection('userSettings').doc(userId).set(
      { purchasedCredits: next, updatedAt: new Date().toISOString() },
      { merge: true },
    )
    return next
  }

  /**
   * Grants purchased credits WITHOUT counting them as a lifetime purchase.
   * Used for transfers (e.g. bounty payouts), so they don't inflate
   * purchase-based metrics.
   */
  public static async grantCredits(userId: string, amount: number) {
    if (amount <= 0) return
    const ref = adminDb.collection('userSettings').doc(userId)
    await ref.set(
      { purchasedCredits: FieldValue.increment(amount), updatedAt: new Date().toISOString() },
      { merge: true },
    )
  }

  /**
   * Escrow hold for a bounty: atomically removes `amount` purchased credits from
   * the poster if they can afford it. Daily credits are never used (they reset).
   * Returns false if the balance is insufficient.
   */
  public static async holdPurchased(userId: string, amount: number): Promise<boolean> {
    if (amount <= 0) return false
    const ref = adminDb.collection('userSettings').doc(userId)
    let ok = false
    await adminDb.runTransaction(async (txn) => {
      const doc = await txn.get(ref)
      const current = (doc.exists ? doc.data()?.purchasedCredits : 0) ?? 0
      if (current >= amount) {
        ok = true
        txn.set(
          ref,
          { purchasedCredits: FieldValue.increment(-amount), updatedAt: new Date().toISOString() },
          { merge: true },
        )
      }
    })
    return ok
  }

  /**
   * Refunds credits to a user.
   * If source is 'purchased', refunds to their Firestore balance.
   * Otherwise, refunds to their Redis daily rate limit count.
   */
  public static async refund(
    userId: string,
    tier: 'FREE' | 'PREMIUM',
    amount: number,
    source: 'daily' | 'purchased'
  ) {
    if (source === 'purchased') {
      await this.addCredits(userId, amount)
    } else {
      await refundRateLimit(userId, tier, amount)
    }
  }
}
