import { adminDb } from './firebase-admin'

/**
 * Atomically claim a Stripe event id before processing it. Stripe delivers
 * at-least-once, and `addCredits()` increments — processing a redelivered
 * `checkout.session.completed` twice would double-credit the buyer. Returns
 * true exactly once per event id; every later claim returns false. Throws when
 * Firestore is unreachable so the caller can fail closed (ask Stripe to retry).
 */
export async function claimStripeEvent(eventId: string, type: string): Promise<boolean> {
  const eventRef = adminDb.collection('stripeEvents').doc(eventId)
  return adminDb.runTransaction(async (txn) => {
    const existing = await txn.get(eventRef)
    if (existing.exists) return false
    txn.set(eventRef, { type, status: 'processing', receivedAt: new Date().toISOString() })
    return true
  })
}

/** Record the terminal state of a claimed event (for observability/replays). */
export async function markStripeEvent(eventId: string, status: 'processed' | 'failed'): Promise<void> {
  await adminDb
    .collection('stripeEvents')
    .doc(eventId)
    .set({ status, finishedAt: new Date().toISOString() }, { merge: true })
}

/**
 * Release a claim after a processing failure, so Stripe's retry can reprocess
 * the event — otherwise a transient failure would permanently skip a
 * legitimate grant.
 */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  await adminDb.collection('stripeEvents').doc(eventId).delete()
}
