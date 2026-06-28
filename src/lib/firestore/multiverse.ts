import { getWorldsByMultiverse } from './worlds'
import { getWorldChronicle } from './chronicle'
import type { WorldEcho } from '@/lib/ai/prompts'

/**
 * Gather the multiverse pool's echoes for ONE world: the legends of the OTHER
 * worlds that share this world's multiverse, bundled per source world. Bounded
 * (a few worlds, a couple of legends each) so prompts stay small. Returns an
 * empty array when the world is in no multiverse, is the only member, or no
 * sibling has legends yet — so an isolated world gets nothing.
 *
 * This is the only place the pool is read. It is keyed by the world's own
 * declared `multiverse.id`; a world that never joined a multiverse is never
 * queried, so nothing can echo into it.
 */
export async function getMultiverseEchoes(
  multiverseId: string,
  selfWorldId: string,
  { maxWorlds = 3, perWorld = 2 }: { maxWorlds?: number; perWorld?: number } = {},
): Promise<WorldEcho[]> {
  const siblings = (await getWorldsByMultiverse(multiverseId).catch(() => []))
    .filter((w) => w.id !== selfWorldId)
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
