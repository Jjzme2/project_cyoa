import type { NodeModeration } from '@/types'

/**
 * Rules-based content moderation for community-submitted routes.
 *
 * Deterministic and dependency-free: clearly-disallowed content is hard
 * `refuse`d (never stored), borderline content is `flag`ged for admin review
 * (stored but hidden from readers), and everything else is `allow`ed.
 *
 * This complements `validate.ts`, which handles length and 4th-wall checks on
 * the raw user prompt; this module classifies the resulting prose content.
 */

export type ModerationAction = 'allow' | 'flag' | 'refuse'

export interface ModerationResult {
  action: ModerationAction
  categories: string[]
  reason?: string
}

export interface Guideline {
  category: string
  severity: 'refuse' | 'flag'
  pattern: RegExp
  reason: string
}

// Hard-refused: never stored, submission is rejected outright.
const REFUSE_GUIDELINES: Guideline[] = [
  {
    category: 'hate',
    severity: 'refuse',
    pattern: /\b(nigger|nigga|faggot|chink|spic|kike|tranny|wetback)\b/i,
    reason: 'Hate speech and slurs are not permitted.',
  },
  {
    category: 'csae',
    severity: 'refuse',
    // Sexual context within close proximity of a minor reference, in either order.
    pattern:
      /\b(child|children|minor|underage|preteen|pre-teen|kid|kids|toddler|little (?:boy|girl))\b[^.?!]{0,48}\b(sex|sexual|naked|nude|porn|fondl\w*|molest\w*|rape|raping)\b|\b(sex|sexual|naked|nude|porn|fondl\w*|molest\w*|rape|raping)\b[^.?!]{0,48}\b(child|children|minor|underage|preteen|pre-teen|kid|kids|toddler|little (?:boy|girl))\b/i,
    reason: 'Sexual content involving minors is strictly prohibited.',
  },
  {
    category: 'mass-harm',
    severity: 'refuse',
    pattern:
      /\b(how to|step[- ]by[- ]step|instructions? (?:to|for))\b[^.?!]{0,40}\b(bomb|explosive|nerve agent|bioweapon|biological weapon|chemical weapon|sarin|anthrax)\b/i,
    reason: 'Instructions for weapons of mass harm are not permitted.',
  },
]

// Flagged for review: stored but hidden from readers until an admin approves.
const FLAG_GUIDELINES: Guideline[] = [
  {
    category: 'sexual',
    severity: 'flag',
    pattern: /\b(explicit sex|hardcore|cumming|blowjob|pornographic|genitals?|erotica?|orgasm)\b/i,
    reason: 'Possible explicit sexual content — needs review.',
  },
  {
    category: 'graphic-violence',
    severity: 'flag',
    pattern: /\b(gore|disembowel\w*|decapitat\w*|mutilat\w*|torture|dismember\w*|eviscerat\w*)\b/i,
    reason: 'Graphic violence — needs review.',
  },
  {
    category: 'self-harm',
    severity: 'flag',
    pattern: /\b(suicide|kill (?:myself|yourself)|self[- ]harm|cut myself|hang myself)\b/i,
    reason: 'Self-harm theme — needs review.',
  },
  {
    category: 'profanity',
    severity: 'flag',
    pattern: /\b(motherfucker|cunt|fuckface)\b/i,
    reason: 'Strong profanity — needs review.',
  },
]

export const CONTENT_GUIDELINES: Guideline[] = [...REFUSE_GUIDELINES, ...FLAG_GUIDELINES]

export function moderateText(text: string): ModerationResult {
  const input = text ?? ''

  const refuseHits = REFUSE_GUIDELINES.filter((g) => g.pattern.test(input))
  if (refuseHits.length > 0) {
    return {
      action: 'refuse',
      categories: [...new Set(refuseHits.map((g) => g.category))],
      reason: refuseHits[0].reason,
    }
  }

  const flagHits = FLAG_GUIDELINES.filter((g) => g.pattern.test(input))
  if (flagHits.length > 0) {
    return {
      action: 'flag',
      categories: [...new Set(flagHits.map((g) => g.category))],
      reason: flagHits[0].reason,
    }
  }

  return { action: 'allow', categories: [] }
}

/**
 * Translate a moderation result into the persisted node fields. `refuse` is
 * handled by the caller (the node is never created), so this only maps
 * `flag` → hidden+flagged and `allow` → published+approved.
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
