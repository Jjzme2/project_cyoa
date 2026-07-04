import type { ModerationResult, ModerationAction } from '../moderation'
import { tryParseJSON } from './shared'
import { runTextWaterfall } from './waterfall'
import { type WorldContext } from './prompts'

export interface ContentJudgment {
  /** Safety verdict in the same shape as rules moderation, for easy combination. */
  safety: ModerationResult
  /** Craft score 0-100 (informational — does not gate publication). */
  quality: { score: number; notes?: string }
  /** How the protagonist's deeds this chapter reflect on them: -1 cruel/treacherous .. +1 kind/honorable. Drives "You" mode reputation. */
  conduct: number
  /** A one-line in-world account of the deed, when it's notable enough to enter the world chronicle. */
  legend?: string
  /** Inferred consequences: how named characters' regard for the protagonist shifted this chapter. */
  relationshipShifts?: { name: string; delta: number }[]
}

/**
 * The Content Judge: an LLM-as-judge that evaluates a freshly generated chapter
 * on two axes in a single call — SAFETY (does it stay within the story's content
 * rating?) and QUALITY (craft score, informational only). The safety verdict is
 * meant to be combined with the rules-based `moderateText` by taking the more
 * restrictive of the two, so the judge can escalate borderline content the regex
 * rules miss but never loosen the rules gate. Returns null on failure so callers
 * fall back to rules-only moderation.
 */
export async function judgeContent(
  chapter: string,
  choiceText: string,
  world: WorldContext,
  userId: string,
  knownCharacters: string[] = [],
): Promise<ContentJudgment | null> {
  const rating = world.rating ?? 'Mature'
  const castLine = knownCharacters.length > 0 ? `Established characters: ${knownCharacters.slice(0, 12).join(', ')}.` : ''

  const aiPrompt = `You are the Content Judge for "Chronicle", a collaborative storytelling platform. Evaluate ONE freshly generated chapter and respond with strict JSON.

CONTENT RATING for this story: ${rating}.
Rating guide — Everyone: wholesome, no violence/profanity/sexual/frightening content. Teen: mild action, peril, and language; no graphic or explicit content. Mature: mature themes allowed, but NEVER sexual content involving minors, hate slurs, or real instructions for serious harm.

1) SAFETY — judge the chapter as fiction against the ${rating} rating:
   - "allow": within the rating.
   - "flag": borderline, or slightly exceeds the rating — hold for human review.
   - "refuse": clearly far beyond the rating, or contains always-prohibited content (sexual content involving minors, hate slurs, real weapons-of-mass-harm instructions).
   Dark or violent themes are acceptable IF the rating allows them. Do NOT refuse merely because a character dies in a Teen/Mature story.

2) QUALITY — score 0-100 for craft: coherence with the chosen path ("${choiceText.slice(0, 120)}"), vividness, tone consistency, and grammatical soundness. Informational only; it does not gate publication.

3) CONDUCT — score -1.0 to 1.0 for how the PROTAGONIST's choice and actions in this chapter reflect on their character morally and socially: -1 cruel, treacherous, or villainous; 0 neutral or ambiguous; +1 kind, brave, or honorable. Judge the protagonist's deeds, not the events that befall them.

4) LEGEND — ONLY if the protagonist's deed this chapter is genuinely notable (clearly heroic or villainous, not routine), write a single in-world sentence a chronicler might record about it (third person; name the protagonist if their name appears in the chapter). Otherwise return an empty string.

5) RELATIONSHIPS — infer the likely consequences of the protagonist's actions on the established characters. ${castLine} For each established character whose feelings toward the protagonist would MEANINGFULLY change because of what happened in this chapter, output {"name": exact character name, "delta": -1.0..1.0} (negative = they now regard the protagonist worse; positive = better). Only include genuinely affected characters; return an empty array if none.

Chapter:
"""${chapter.slice(0, 2000)}"""

Respond with ONLY valid JSON, no markdown:
{"safety":{"action":"allow|flag|refuse","reason":"short reason if flag/refuse, else empty"},"quality":{"score":0,"notes":"one short phrase"},"conduct":0,"legend":"","relationshipShifts":[]}`

  const normalize = (data: Record<string, unknown>): ContentJudgment => {
    const s = (data.safety ?? {}) as Record<string, unknown>
    const a = String(s.action ?? 'allow').toLowerCase()
    const action: ModerationAction = a === 'refuse' ? 'refuse' : a === 'flag' ? 'flag' : 'allow'
    const q = (data.quality ?? {}) as Record<string, unknown>
    let score = Number(q.score)
    if (!Number.isFinite(score)) score = 0
    score = Math.max(0, Math.min(100, Math.round(score)))
    let conduct = Number(data.conduct)
    if (!Number.isFinite(conduct)) conduct = 0
    conduct = Math.max(-1, Math.min(1, conduct))
    return {
      safety: {
        action,
        categories: action === 'allow' ? [] : ['ai-judge'],
        reason:
          action === 'allow'
            ? undefined
            : String(s.reason ?? '').trim().slice(0, 200) || 'Flagged by the content judge.',
      },
      quality: { score, notes: String(q.notes ?? '').trim().slice(0, 120) || undefined },
      conduct,
      legend: String(data.legend ?? '').trim().slice(0, 240) || undefined,
      relationshipShifts: Array.isArray(data.relationshipShifts)
        ? (data.relationshipShifts as Record<string, unknown>[])
            .map((r) => ({ name: String(r?.name ?? '').trim().slice(0, 60), delta: Math.max(-1, Math.min(1, Number(r?.delta) || 0)) }))
            .filter((r) => r.name && r.delta)
            .slice(0, 8)
        : [],
    }
  }

  try {
    const { text } = await runTextWaterfall({ prompt: aiPrompt, userId, maxOutputTokens: 200, feature: 'content-judge' })
    return normalize(tryParseJSON(text))
  } catch {
    return null // fall back to rules-only moderation
  }
}

