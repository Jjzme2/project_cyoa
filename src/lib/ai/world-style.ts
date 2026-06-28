import type { WorldStorySettings } from '@/types'

/**
 * Per-chapter selection of a world's prose style. Deterministic by chapter so a
 * world that offers several styles rotates through them (variety the reader can
 * feel) while staying reproducible for a given chapter index.
 */
export function selectProseStyle(styles: string[] | undefined, chapterIndex: number): string | null {
  const pool = (styles ?? []).map((s) => s.trim()).filter(Boolean)
  if (pool.length === 0) return null
  const i = ((Math.trunc(chapterIndex) % pool.length) + pool.length) % pool.length
  return pool[i]
}

/**
 * Build the WORLD STYLE prompt block: the world's mandate, the prose style
 * chosen for this chapter, and any recurring motifs. Returns '' when the world
 * has no story settings.
 */
export function worldStyleBlock(settings: WorldStorySettings | undefined, chapterIndex: number): string {
  if (!settings) return ''
  const lines: string[] = []

  if (settings.mandate?.trim()) {
    lines.push(`MANDATE (this world requires it — honor it in this chapter): ${settings.mandate.trim()}`)
  }

  const prose = selectProseStyle(settings.proseStyles, chapterIndex)
  if (prose) {
    lines.push(
      `PROSE STYLE for this chapter: ${prose} — render the prose in this style while keeping the content rating, continuity, and word limit.`,
    )
  }

  const motifs = (settings.motifs ?? []).map((m) => m.trim()).filter(Boolean)
  if (motifs.length > 0) {
    lines.push(`RECURRING MOTIFS (weave in naturally where they fit; never force): ${motifs.join('; ')}`)
  }

  return lines.length > 0 ? `\nWORLD STYLE:\n${lines.map((l) => `- ${l}`).join('\n')}\n` : ''
}
