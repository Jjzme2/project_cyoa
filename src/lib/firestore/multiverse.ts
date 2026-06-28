import { getWorldsByMultiverse, getPublicWorlds } from './worlds'
import { getWorldChronicle } from './chronicle'
import { ratingRank } from '@/lib/ratings'
import type { WorldEcho } from '@/lib/ai/prompts'
import type { ContentRating } from '@/types'

/**
 * Gather the multiverse pool's echoes for ONE world: the legends of the OTHER
 * worlds that share this world's multiverse, bundled per source world. Bounded
 * (a few worlds, a couple of legends each) so prompts stay small. Returns an
 * empty array when the world is in no multiverse, is the only member, or no
 * sibling has legends yet — so an isolated world gets nothing.
 *
 * Because the pool is a global collective (any author may join a named
 * multiverse), echoes are rating-gated: a sibling world rated ABOVE the
 * consuming world's ceiling is skipped entirely, so a Mature world's legends can
 * never drift into an Everyone story.
 *
 * This is the only place the pool is read. It is keyed by the world's own
 * declared `multiverse.id`; a world that never joined a multiverse is never
 * queried, so nothing can echo into it.
 */
export async function getMultiverseEchoes(
  multiverseId: string,
  selfWorldId: string,
  { maxRating, maxWorlds = 3, perWorld = 2 }: { maxRating?: ContentRating; maxWorlds?: number; perWorld?: number } = {},
): Promise<WorldEcho[]> {
  const ceiling = maxRating ? ratingRank(maxRating) : null
  const siblings = (await getWorldsByMultiverse(multiverseId).catch(() => []))
    .filter((w) => w.id !== selfWorldId)
    // Rating safety: never pull legends from a world more mature than this one.
    .filter((w) => ceiling === null || ratingRank(w.rating ?? 'Everyone') <= ceiling)
    .slice(0, maxWorlds)

  const echoes = await Promise.all(
    siblings.map(async (w) => {
      const chronicle = await getWorldChronicle(w.id).catch(() => [])
      const legends = chronicle.map((e) => e.text).filter((t) => t.trim()).slice(0, perWorld)
      return legends.length ? { worldName: w.name, legends } : null
    }),
  )

  return echoes.filter((e): e is WorldEcho => e !== null)
}

/**
 * The distinct multiverses visible across public worlds, for join suggestions.
 * Lets any creator discover and opt into an existing collective by its exact name.
 */
export async function getPublicMultiverses(): Promise<{ id: string; name: string }[]> {
  const worlds = await getPublicWorlds().catch(() => [])
  const seen = new Map<string, string>()
  for (const w of worlds) {
    if (w.multiverse?.id && !seen.has(w.multiverse.id)) seen.set(w.multiverse.id, w.multiverse.name)
  }
  return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
