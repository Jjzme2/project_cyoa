import { getWorldsByMultiverse, getPublicWorlds, getWorld } from './worlds'
import { getWorldChronicle } from './chronicle'
import { ratingRank } from '@/lib/ratings'
import type { WorldEcho } from '@/lib/ai/prompts'
import type { ContentRating, WorldLink } from '@/types'

/**
 * Validate and normalize explicit link inputs into stored WorldLinks: each
 * target must exist, its REAL name is taken from the loaded world (never a
 * client label), self-links are dropped, deduped, and capped. Shared by world
 * creation and editing so both resolve links identically.
 */
export async function resolveWorldLinks(
  inputs: { worldId: string; nexus?: string }[],
  { excludeWorldId, cap = 5 }: { excludeWorldId?: string; cap?: number } = {},
): Promise<WorldLink[]> {
  const seen = new Set<string>()
  const out: WorldLink[] = []
  for (const l of inputs.slice(0, 8)) {
    if (!l.worldId || l.worldId === excludeWorldId || seen.has(l.worldId)) continue
    seen.add(l.worldId)
    const target = await getWorld(l.worldId).catch(() => null)
    if (!target) continue
    const nexus = l.nexus?.trim().slice(0, 120)
    out.push({ worldId: l.worldId, worldName: target.name, ...(nexus ? { nexus } : {}) })
    if (out.length >= cap) break
  }
  return out
}

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
 * Echoes from a world's EXPLICIT links (fold 2): legends from each hand-picked
 * world, bundled per source, rating-gated the same way as the pool. Bounded so
 * prompts stay small. A world with no links gets nothing.
 */
export async function getLinkedEchoes(
  links: WorldLink[],
  { maxRating, maxWorlds = 4, perWorld = 2 }: { maxRating?: ContentRating; maxWorlds?: number; perWorld?: number } = {},
): Promise<WorldEcho[]> {
  const ceiling = maxRating ? ratingRank(maxRating) : null
  const picked = links.slice(0, maxWorlds)

  const echoes = await Promise.all(
    picked.map(async (link) => {
      const world = await getWorld(link.worldId).catch(() => null)
      if (!world) return null
      // Rating safety: never pull from a world more mature than this one.
      if (ceiling !== null && ratingRank(world.rating ?? 'Everyone') > ceiling) return null
      const chronicle = await getWorldChronicle(link.worldId).catch(() => [])
      const legends = chronicle.map((e) => e.text).filter((t) => t.trim()).slice(0, perWorld)
      if (!legends.length) return null
      const nexus = link.nexus?.trim()
      return { worldName: world.name, ...(nexus ? { nexus } : {}), legends }
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
