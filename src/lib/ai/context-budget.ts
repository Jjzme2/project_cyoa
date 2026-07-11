import type { StoryCharacter, Protagonist } from '@/types'

/**
 * Dense, budget-aware context formatting for prompts.
 *
 * The cast can grow to ~40 characters; dumping each as a verbose line bloats
 * every prompt and can crowd out the actual story. This formats the roster as
 * compact key:value entries (`Name(status)=desc`) under a character budget,
 * while never dropping anyone from awareness: characters that don't fit the
 * detailed budget are still listed by name+status, so the model knows they
 * exist (and won't revive the dead, rename, or repurpose anyone).
 */

export interface CastBudgetOptions {
  /** Char budget for the detailed (described) entries. */
  detailBudget?: number
  /** Max chars kept per character description. */
  descMax?: number
}

// Raised from 1400 when depth fields (wants/voice/arc) joined each entry —
// the same greedy fill still guarantees graceful overflow for huge casts.
const DEFAULT_DETAIL_BUDGET = 1900
const DEFAULT_DESC_MAX = 90

/** Lower-priority statuses appear after the living, who are likelier to act. */
function isLikelyActive(status?: string): boolean {
  const s = (status ?? 'alive').toLowerCase()
  return s === 'alive' || s === 'active' || s === 'present'
}

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

/** `Name(status)` — the minimal awareness token for any character. */
function tag(c: StoryCharacter): string {
  const status = (c.status ?? '').trim()
  return status && status.toLowerCase() !== 'alive' ? `${c.name}(${status})` : c.name
}

/**
 * Build the PROTAGONIST + CAST block, compact and budgeted. Returns '' when
 * there's no cast to describe.
 */
export function formatCast(
  protagonist: Protagonist | undefined,
  characters: StoryCharacter[] | undefined,
  opts: CastBudgetOptions = {},
): string {
  const detailBudget = opts.detailBudget ?? DEFAULT_DETAIL_BUDGET
  const descMax = opts.descMax ?? DEFAULT_DESC_MAX

  const blocks: string[] = []

  if (protagonist?.name) {
    const desc = protagonist.description ? ` — ${clip(protagonist.description, 140)}` : ''
    blocks.push(
      `PROTAGONIST (the reader plays as them — refer to them by name, not "you"): ${protagonist.name}${desc}`,
    )
  }

  const roster = (characters ?? []).filter((c) => c?.name)
  if (roster.length > 0) {
    // Living figures first (likelier to act), original order preserved within.
    const ordered = [...roster].sort((a, b) => Number(isLikelyActive(b.status)) - Number(isLikelyActive(a.status)))

    const detailed: string[] = []
    const overflow: StoryCharacter[] = []
    let used = 0
    for (const c of ordered) {
      // Depth fields ride along compactly: `Name=desc [wants: …; voice: …; now: …]`
      // — the drive that makes their scenes theirs, how they sound, and how the
      // story has changed them (the CHARACTER_UPDATE arc).
      const depth = [
        c.want ? `wants: ${clip(c.want, 60)}` : '',
        c.voice ? `voice: ${clip(c.voice, 50)}` : '',
        c.arc ? `now: ${clip(c.arc, 80)}` : '',
      ].filter(Boolean)
      const depthSuffix = depth.length > 0 ? ` [${depth.join('; ')}]` : ''
      const entry = c.description ? `${tag(c)}=${clip(c.description, descMax)}${depthSuffix}` : `${tag(c)}${depthSuffix}`
      if (used + entry.length + 2 <= detailBudget || detailed.length === 0) {
        detailed.push(entry)
        used += entry.length + 2
      } else {
        overflow.push(c)
      }
    }

    const lines = [
      'CAST (canon — keep every identity, status, and relationship perfectly consistent; never revive the dead, rename, or repurpose anyone):',
      detailed.join('; '),
    ]
    if (overflow.length > 0) {
      lines.push(`Also present (keep consistent if they reappear): ${overflow.map(tag).join(', ')}`)
    }
    blocks.push(lines.join('\n'))
  }

  return blocks.length > 0 ? `\n${blocks.join('\n\n')}\n` : ''
}
