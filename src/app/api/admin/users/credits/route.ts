import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { resetDailyUses } from '@/lib/rate-limit'
import { insights } from '@/lib/telemetry'

const MAX_AMOUNT = 100_000

const CreditsSchema = z.object({
  uid: z.string().trim().min(1, 'Missing uid'),
  action: z.enum(['grant', 'set', 'refreshDaily'], { message: 'Invalid action' }),
  // Coerced and clamped below; invalid input falls back to 0 as before.
  amount: z.coerce.number().catch(0).default(0),
})

/**
 * Admin-only credit controls for a single user:
 *   - grant: add N purchased credits
 *   - set: set the purchased-credit balance to exactly N
 *   - refreshDaily: clear today's daily AI usage, restoring the full allowance
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJson(req, CreditsSchema)
  if (!parsed.ok) return parsed.response
  const { uid, action, amount: rawAmount } = parsed.data

  // Resolve the target's tier (needed for the daily reset) and confirm they exist.
  let tier: 'FREE' | 'PREMIUM' = 'FREE'
  try {
    const target = await adminAuth.getUser(uid)
    tier = ((target.customClaims?.tier as 'FREE' | 'PREMIUM') ?? 'FREE')
  } catch {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const amount = Math.min(Math.abs(Math.floor(rawAmount)), MAX_AMOUNT)

  let result: Record<string, unknown> = {}
  if (action === 'grant') {
    if (amount <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    await CreditManager.addCredits(uid, amount)
    const info = await CreditManager.getCreditsInfo(uid, tier)
    result = { purchasedCredits: info.purchasedCredits }
  } else if (action === 'set') {
    const next = await CreditManager.setPurchasedCredits(uid, amount)
    result = { purchasedCredits: next }
  } else {
    const ok = await resetDailyUses(uid, tier)
    if (!ok) return NextResponse.json({ error: 'Could not refresh daily allowance' }, { status: 502 })
    result = { dailyRefreshed: true }
  }

  await insights.track('admin.credits_adjusted', {
    uid: auth.uid,
    props: { targetUid: uid, action, amount, byEmail: auth.email },
  })

  return NextResponse.json({ ok: true, ...result })
}
