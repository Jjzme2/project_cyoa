import { Redis } from '@upstash/redis'

export const FREE_DAILY_LIMIT = 20
export const PREMIUM_DAILY_LIMIT = 100

function getRedis() {
  return Redis.fromEnv()
}

function dailyKey(userId: string, tier: 'FREE' | 'PREMIUM') {
  const prefix = tier === 'PREMIUM' ? 'cyoa:premium:daily' : 'cyoa:free:daily'
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  return `${prefix}:${userId}:${date}`
}

function endOfDayUTC(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
}

export function dailyLimit(tier: 'FREE' | 'PREMIUM') {
  return tier === 'PREMIUM' ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT
}

/**
 * Lightweight fixed-window throttle for abuse-guarding non-credit endpoints
 * (feedback, client tracking). Returns true if the action is allowed.
 *
 * Fails OPEN: if Redis is unreachable we allow the action rather than block
 * legitimate users — the opposite of the credit path (which fails closed),
 * because here there is no per-call cost to protect, only spam to discourage.
 */
export async function throttle(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const redis = getRedis()
    const window = Math.floor(Date.now() / 1000 / windowSeconds)
    const key = `cyoa:throttle:${bucket}:${window}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSeconds + 5)
    return count <= max
  } catch {
    return true // fail open — never block a real user on a Redis hiccup
  }
}

export async function checkRateLimit(
  userId: string,
  tier: 'FREE' | 'PREMIUM' = 'FREE',
  credits = 1,
): Promise<{ success: boolean; remaining: number; reset: number; degraded?: boolean }> {
  try {
    const redis = getRedis()
    const key = dailyKey(userId, tier)
    const limit = dailyLimit(tier)

    const count = await redis.incrby(key, credits)
    if (count === credits) {
      const ttl = Math.ceil((endOfDayUTC() - Date.now()) / 1000) + 3600
      await redis.expire(key, ttl)
    }

    const remaining = Math.max(0, limit - count)
    return { success: count <= limit, remaining, reset: endOfDayUTC() }
  } catch (err) {
    // Redis is unreachable, so we can't verify or decrement the daily allowance.
    // FAIL CLOSED for the free/daily path: do NOT grant a free generation (each
    // one costs real money). `degraded` lets CreditManager fall through to
    // purchased credits — the paid path stays open — and denies otherwise.
    console.error('[rate-limit] checkRateLimit failed closed (Redis unreachable):', err)
    return { success: false, remaining: 0, reset: endOfDayUTC(), degraded: true }
  }
}

export async function refundRateLimit(
  userId: string,
  tier: 'FREE' | 'PREMIUM' = 'FREE',
  credits = 1,
) {
  try {
    const redis = getRedis()
    const key = dailyKey(userId, tier)
    const count = await redis.get<number>(key) ?? 0
    if (count > 0) await redis.decrby(key, Math.min(credits, count))
  } catch {
    // best-effort
  }
}

/**
 * Clears a user's daily AI usage counter, restoring their full daily allowance
 * immediately (used by admin "refresh credits"). Best-effort.
 */
export async function resetDailyUses(
  userId: string,
  tier: 'FREE' | 'PREMIUM' = 'FREE',
): Promise<boolean> {
  try {
    const redis = getRedis()
    await redis.del(dailyKey(userId, tier))
    return true
  } catch {
    return false
  }
}

export async function getRemainingUses(
  userId: string,
  tier: 'FREE' | 'PREMIUM' = 'FREE',
): Promise<{ remaining: number; limit: number; reset: number }> {
  try {
    const redis = getRedis()
    const key = dailyKey(userId, tier)
    const limit = dailyLimit(tier)
    const count = (await redis.get<number>(key)) ?? 0
    return { remaining: Math.max(0, limit - count), limit, reset: endOfDayUTC() }
  } catch {
    const limit = dailyLimit(tier)
    return { remaining: limit, limit, reset: endOfDayUTC() }
  }
}
