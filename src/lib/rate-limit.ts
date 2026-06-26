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

export async function checkRateLimit(
  userId: string,
  tier: 'FREE' | 'PREMIUM' = 'FREE',
  credits = 1,
): Promise<{ success: boolean; remaining: number; reset: number }> {
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
  } catch {
    return { success: true, remaining: FREE_DAILY_LIMIT, reset: endOfDayUTC() }
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
