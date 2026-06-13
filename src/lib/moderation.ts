import type { ContentRating, NodeModeration } from '@/types'
import { ratingRank } from './ratings'

/**
 * Rules-based, rating-aware content moderation for community-submitted routes.
 *
 * Deterministic and dependency-free. Some content is always refused (slurs,
 * sexual content involving minors, mass-harm instructions). Everything else is
 * judged against the story's content rating: violence, profanity, sexual or
 * frightening themes that are fine in a Mature story are flagged for review —
 * or refused outright — in an Everyone-rated one. So an Everyone world stays
 * wholesome, while a Mature world allows mature themes.
 */

export type ModerationAction = 'allow' | 'flag' | 'refuse'

export interface ModerationResult {
  action: ModerationAction
  categories: string[]
  reason?: string
}

interface Guideline {
  category: string
  pattern: RegExp
  /** Lowest content rating at which this content is allowed without review. */
  minRating: ContentRating
  /** Absolute prohibition — refused at every rating. */
  hardRefuse?: boolean
  /** Flag for review even when within an allowed-rating context. */
  reviewWhenAllowed?: boolean
  reason: string
}

const GUIDELINES: Guideline[] = [
  // ── Absolute prohibitions (refused at any rating) ──────────────────────────
  {
    category: 'hate',
    pattern: /\b(nigger|nigga|faggot|chink|spic|kike|tranny|wetback)\b/i,
    minRating: 'Mature',
    hardRefuse: true,
    reason: 'Hate speech and slurs are not permitted',
  },
  {
    category: 'csae',
    pattern:
      /\b(child|children|minor|underage|preteen|pre-teen|kid|kids|toddler|little (?:boy|girl))\b[^.?!]{0,48}\b(sex|sexual|naked|nude|porn|fondl\w*|molest\w*|rape|raping)\b|\b(sex|sexual|naked|nude|porn|fondl\w*|molest\w*|rape|raping)\b[^.?!]{0,48}\b(child|children|minor|underage|preteen|pre-teen|kid|kids|toddler|little (?:boy|girl))\b/i,
    minRating: 'Mature',
    hardRefuse: true,
    reason: 'Sexual content involving minors is strictly prohibited',
  },
  {
    category: 'mass-harm',
    pattern:
      /\b(how to|step[- ]by[- ]step|instructions? (?:to|for))\b[^.?!]{0,40}\b(bomb|explosive|nerve agent|bioweapon|biological weapon|chemical weapon|sarin|anthrax)\b/i,
    minRating: 'Mature',
    hardRefuse: true,
    reason: 'Instructions for weapons of mass harm are not permitted',
  },

  // ── Rating-graded content ──────────────────────────────────────────────────
  {
    category: 'graphic-violence',
    pattern: /\b(gore|disembowel\w*|decapitat\w*|mutilat\w*|torture|dismember\w*|eviscerat\w*)\b/i,
    minRating: 'Mature',
    reviewWhenAllowed: true,
    reason: 'Graphic violence',
  },
  {
    category: 'violence',
    pattern:
      /\b(kill|killed|killing|stab|stabbed|murder\w*|slay|slain|behead\w*|assault|gunshot|gun|shoot|shot|wound\w*|bleeding|sword|dagger|blade|fight|battle|corpse)\b/i,
    minRating: 'Teen',
    reason: 'Violence',
  },
  {
    category: 'explicit-sexual',
    pattern: /\b(explicit sex|hardcore|cumming|blowjob|pornographic|genitals?|erotica?|orgasm)\b/i,
    minRating: 'Mature',
    reviewWhenAllowed: true,
    reason: 'Explicit sexual content',
  },
  {
    category: 'suggestive',
    pattern: /\b(seduce\w*|naked|nude|lust\w*|aroused|undress\w*|making out|in bed together)\b/i,
    minRating: 'Teen',
    reason: 'Suggestive content',
  },
  {
    category: 'strong-profanity',
    pattern: /\b(fuck\w*|cunt|motherfucker|fuckface)\b/i,
    minRating: 'Mature',
    reason: 'Strong profanity',
  },
  {
    category: 'mild-profanity',
    pattern: /\b(damn|hell|crap|arse|ass|bastard|bloody|bitch)\b/i,
    minRating: 'Teen',
    reason: 'Mild profanity',
  },
  {
    category: 'self-harm',
    pattern: /\b(suicide|kill (?:myself|yourself)|self[- ]harm|cut myself|hang myself)\b/i,
    minRating: 'Mature',
    reviewWhenAllowed: true,
    reason: 'Self-harm theme',
  },
  {
    category: 'frightening',
    pattern: /\b(terror|terrifying|nightmare|haunt\w*|demon\w*|horror|gruesome|monstrous|gory)\b/i,
    minRating: 'Teen',
    reason: 'Frightening themes',
  },
]

export const CONTENT_GUIDELINES: Guideline[] = GUIDELINES

function dedupe(list: Guideline[]): string[] {
  return [...new Set(list.map((g) => g.category))]
}

/**
 * Moderate text within a content-rating context. Defaults to `Mature` (most
 * permissive) when no rating is supplied.
 */
export function moderateText(text: string, contextRating: ContentRating = 'Mature'): ModerationResult {
  const input = text ?? ''
  const matches = GUIDELINES.filter((g) => g.pattern.test(input))
  if (matches.length === 0) return { action: 'allow', categories: [] }

  // Absolute prohibitions always refuse.
  const hard = matches.filter((m) => m.hardRefuse)
  if (hard.length > 0) {
    return { action: 'refuse', categories: dedupe(hard), reason: `${hard[0].reason}.` }
  }

  const ctx = ratingRank(contextRating)

  // Content more mature than the story's rating allows.
  const exceeding = matches.filter((m) => ratingRank(m.minRating) > ctx)
  if (exceeding.length > 0) {
    const gap = Math.max(...exceeding.map((m) => ratingRank(m.minRating) - ctx))
    const cats = dedupe(exceeding)
    if (gap >= 2) {
      // e.g. graphic violence / explicit content in an Everyone-rated story.
      return {
        action: 'refuse',
        categories: cats,
        reason: `${exceeding[0].reason} is not allowed in a ${contextRating}-rated story.`,
      }
    }
    return {
      action: 'flag',
      categories: cats,
      reason: `${exceeding[0].reason} exceeds this story's ${contextRating} rating — held for review.`,
    }
  }

  // Within the allowed rating, but some categories always warrant review.
  const review = matches.filter((m) => m.reviewWhenAllowed)
  if (review.length > 0) {
    return { action: 'flag', categories: dedupe(review), reason: `${review[0].reason} — held for review.` }
  }

  return { action: 'allow', categories: [] }
}

/**
 * Translate a moderation result into persisted node fields. `refuse` is handled
 * by the caller (the node is never created).
 */
export function moderationToNodeFields(
  result: ModerationResult,
): { published: boolean; moderation: NodeModeration } {
  if (result.action === 'flag') {
    return {
      published: false,
      moderation: {
        status: 'flagged',
        categories: result.categories,
        reason: result.reason,
        reviewedBy: null,
        reviewedAt: null,
      },
    }
  }
  return {
    published: true,
    moderation: { status: 'approved', reviewedBy: null, reviewedAt: null },
  }
}
