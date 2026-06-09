import { NextRequest, NextResponse } from 'next/server'
import { getPublicWorlds, getStories } from '@/lib/firestore-helpers'

export async function GET(_req: NextRequest) {
  const [worlds, stories] = await Promise.all([getPublicWorlds(100), getStories(500)])

  const storyCountByWorldId = new Map<string, number>()
  for (const s of stories) {
    storyCountByWorldId.set(s.worldId, (storyCountByWorldId.get(s.worldId) ?? 0) + 1)
  }

  const worldsWithCount = worlds.map((w) => ({
    ...w,
    storyCount: storyCountByWorldId.get(w.id) ?? 0,
  }))

  return NextResponse.json({ worlds: worldsWithCount })
}
