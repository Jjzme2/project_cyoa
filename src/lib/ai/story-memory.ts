import type { StoryPathSegment } from '@/types'

/**
 * Budget-aware formatting of the story-so-far.
 *
 * The prompt used to inject every prior chapter verbatim, so a long story's
 * context grew without bound — expensive, and it crowded out the actual
 * instructions. This keeps the parts that matter most for continuity verbatim
 * (the opening, which establishes premise/protagonist/setting, and the most
 * recent chapters) while compressing the middle into a one-line digest per
 * chapter (the choice taken + a short excerpt). The arc is preserved; the token
 * cost is bounded. Short stories are returned in full, unchanged.
 *
 * Deterministic — no extra model call.
 */

export interface PathBudgetOptions {
  /** Most-recent chapters kept verbatim. */
  recentFull?: number
  /** Max chars per digested (middle) chapter. */
  digestMax?: number
}

const DEFAULT_RECENT_FULL = 4
const DEFAULT_DIGEST_MAX = 180

function chapterHeader(seg: StoryPathSegment, num: number): string {
  return seg.choiceText
    ? `The reader chose: "${seg.choiceText}"\nChapter ${num}:`
    : `Chapter ${num} (Beginning):`
}

function excerpt(text: string, max: number): string {
  const t = (text || '').trim().replace(/\s+/g, ' ')
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

function full(seg: StoryPathSegment, num: number): string {
  return `${chapterHeader(seg, num)}\n${seg.content}`
}

export function formatStoryPath(storyPath: StoryPathSegment[], opts: PathBudgetOptions = {}): string {
  const recentFull = opts.recentFull ?? DEFAULT_RECENT_FULL
  const digestMax = opts.digestMax ?? DEFAULT_DIGEST_MAX
  const n = storyPath.length

  // Short stories: keep everything verbatim (no behavior change).
  if (n <= recentFull + 2) {
    return storyPath.map((seg, i) => full(seg, i + 1)).join('\n\n')
  }

  const parts: string[] = [full(storyPath[0], 1)] // opening, always verbatim

  // Middle — compressed to a digest line each.
  const midEnd = n - recentFull // exclusive
  const digests: string[] = []
  for (let i = 1; i < midEnd; i++) {
    const seg = storyPath[i]
    const choice = seg.choiceText ? `chose "${seg.choiceText}" → ` : ''
    digests.push(`- Ch${i + 1}: ${choice}${excerpt(seg.content, digestMax)}`)
  }
  if (digests.length > 0) {
    parts.push(`[STORY MEMORY — earlier chapters, condensed for continuity (honor these as established):\n${digests.join('\n')}]`)
  }

  // Recent chapters — verbatim.
  for (let i = midEnd; i < n; i++) parts.push(full(storyPath[i], i + 1))

  return parts.join('\n\n')
}
