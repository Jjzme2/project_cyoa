/**
 * Pure, dependency-free helpers for the Share Card renderer. Kept separate from
 * `share-card.tsx` (which imports `next/og`) so they can be unit-tested without
 * pulling in the image runtime.
 */

export type ShareCardKind = 'character' | 'ending' | 'world' | 'story'

export interface ShareCardStat {
  value: string
  label: string
}

/** Accent colour per card kind — keeps each unit visually distinct but on-brand. */
export function accentFor(kind: ShareCardKind): string {
  switch (kind) {
    case 'character':
      return '#c4b5fd' // violet — a person
    case 'ending':
      return '#6ee7b7' // emerald — an achievement
    case 'world':
      return '#5eead4' // teal — a place
    default:
      return '#f5d896' // gold — the house colour
  }
}

/** Keep at most three stats and drop any with an empty value/label, so the row
 * never renders a hollow chip. */
export function normalizeStats(stats?: ShareCardStat[]): ShareCardStat[] {
  if (!stats) return []
  return stats.filter((s) => s.value.trim() !== '' && s.label.trim() !== '').slice(0, 3)
}

/** Render "1 of 340" style rarity for an ending from raw counts; returns null
 * when the numbers can't say anything meaningful. */
export function rarityStat(reached?: number, total?: number): ShareCardStat | null {
  if (!reached || reached < 1) return null
  if (total && total >= reached) {
    return { value: `${reached} of ${total}`, label: 'reached this ending' }
  }
  return {
    value: reached.toLocaleString('en-US'),
    label: reached === 1 ? 'reader reached it' : 'readers reached it',
  }
}
