import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getStories, getPublicWorlds, getModerationQueue } from '@/lib/firestore-helpers'
import { getDailyBuckets } from '@/lib/telemetry'

// Caps on the best-effort counts below. The moderation queue is the actionable
// number and is reported in full (up to its own cap); story/world totals are
// sampled for an at-a-glance sense of scale rather than exact accounting.
const STORY_SAMPLE = 500
const WORLD_SAMPLE = 200
const QUEUE_LIMIT = 100

/** Admin-only: at-a-glance counts for the admin dashboard. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [stories, worlds, queue, analyticsToday, insightsToday] = await Promise.all([
    getStories(STORY_SAMPLE).catch(() => []),
    getPublicWorlds(WORLD_SAMPLE).catch(() => []),
    getModerationQueue(QUEUE_LIMIT).catch(() => []),
    // Today's rollup is a single cheap doc read per channel.
    getDailyBuckets('analytics', 1),
    getDailyBuckets('insights', 1),
  ])

  return NextResponse.json({
    pendingModeration: queue.length,
    pendingModerationCapped: queue.length >= QUEUE_LIMIT,
    stories: stories.length,
    storiesCapped: stories.length >= STORY_SAMPLE,
    worlds: worlds.length,
    worldsCapped: worlds.length >= WORLD_SAMPLE,
    eventsToday: analyticsToday[0]?.total ?? 0,
    insightsToday: insightsToday[0]?.total ?? 0,
  })
}
