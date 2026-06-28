import type { GenesisRegion, WorldBible } from '@/types'

/**
 * Deterministic 2D layout for a world's regions, so the same world always maps
 * the same way and the reader can build a stable mental geography. Regions are
 * spread with a golden-angle spiral (organic, well-distributed) rotated by the
 * world seed, with a touch of name-seeded jitter so it never looks mechanical.
 */

export interface MappedRegion {
  name: string
  biome: string
  description: string
  /** Normalized position in [0,1]; render against any viewport. */
  x: number
  y: number
}

export interface RegionLink {
  from: string
  to: string
  /** 'ally' = a road/bond; 'rival' = a contested border. */
  kind: 'ally' | 'rival'
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** FNV-1a → [0,1). */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

const clamp01 = (v: number) => (v < 0.04 ? 0.04 : v > 0.96 ? 0.96 : v)

export function layoutRegions(regions: GenesisRegion[] | undefined, seed = 0): MappedRegion[] {
  const list = regions ?? []
  const n = list.length
  if (n === 0) return []

  const rot = (((seed % 360) + 360) % 360) * (Math.PI / 180)
  return list.map((r, i) => {
    const radius = n === 1 ? 0 : Math.sqrt((i + 0.5) / n) * 0.42
    const angle = i * GOLDEN_ANGLE + rot
    const jx = (hash01(`${r.name}:x`) - 0.5) * 0.06
    const jy = (hash01(`${r.name}:y`) - 0.5) * 0.06
    return {
      name: r.name,
      biome: r.biome,
      description: r.description,
      x: clamp01(0.5 + radius * Math.cos(angle) + jx),
      y: clamp01(0.5 + radius * Math.sin(angle) + jy),
    }
  })
}

/**
 * Links between regions derived from faction relationships: a faction's seat
 * region connects to its ally's and rival's seats. Only links whose endpoints
 * are both present in the map are returned, deduped.
 */
export function regionLinks(bible: WorldBible | undefined): RegionLink[] {
  const factions = bible?.factions ?? []
  const seatOf = new Map(factions.map((f) => [f.name, f.seat]))
  const regionNames = new Set((bible?.regions ?? []).map((r) => r.name))
  const seen = new Set<string>()
  const links: RegionLink[] = []

  const add = (a: string | undefined, b: string | undefined, kind: 'ally' | 'rival') => {
    if (!a || !b || a === b || !regionNames.has(a) || !regionNames.has(b)) return
    const key = [a, b].sort().join('|') + kind
    if (seen.has(key)) return
    seen.add(key)
    links.push({ from: a, to: b, kind })
  }

  for (const f of factions) {
    if (f.allyOf) add(seatOf.get(f.name), seatOf.get(f.allyOf), 'ally')
    if (f.rivalOf) add(seatOf.get(f.name), seatOf.get(f.rivalOf), 'rival')
  }
  return links
}
