import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { adminAuth } from '@/lib/firebase-admin'
import { CreditManager } from '@/lib/credit-manager'
import { resetDailyUses } from '@/lib/rate-limit'
import { insights } from '@/lib/telemetry'

type Action = 'grant' | 'set' | 'refreshDaily'
const ACTIONS: Action[] = ['grant', 'set', 'refreshDaily']
const MAX_AMOUNT = 100_000

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

  let body: { uid?: string; action?: string; amount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const uid = typeof body.uid === 'string' ? body.uid.trim() : ''
  const action = body.action as Action
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  // Resolve the target's tier (needed for the daily reset) and confirm they exist.
  let tier: 'FREE' | 'PREMIUM' = 'FREE'
  try {
    const target = await adminAuth.getUser(uid)
    tier = ((target.customClaims?.tier as 'FREE' | 'PREMIUM') ?? 'FREE')
  } catch {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const amount = Math.min(Math.abs(Math.floor(Number(body.amount) || 0)), MAX_AMOUNT)

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
