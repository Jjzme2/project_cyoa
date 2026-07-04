import type { World } from '@/types'

/**
 * The narrative SHAPE of a world's stories.
 *
 * `dramatic` — the traditional arc: conflict, stakes, reckonings (default).
 * `gentle`   — conflict-free: arcs of wonder, friendship, and shared joy; no
 *              villains, threats, or manufactured danger, ever.
 * `dark`     — heavier than dramatic: dread, moral cost, and consequences that
 *              don't get undone; no guaranteed happy ending.
 * `absurd`   — surreal and comedic: illogical escalation played with total
 *              deadpan sincerity; the world is silly, everyone in it is not.
 * `melancholic` — quiet sorrow and bittersweet longing: memory, distance, and
 *              things left unsaid or already lost; no danger required.
 * `mystery`  — a puzzle to solve: concrete clues, red herrings, and a truth
 *              the protagonist is chasing down.
 * `slice_of_life` — ordinary and low-stakes: everyday routines, small
 *              frictions, and human-scale moments; nothing ever looms.
 * `custom`   — an author's own AI-generated through-line (credit-gated),
 *              stored on the story itself (`Story.customNarrativeShape`).
 *
 * Only `gentle` is ever auto-derived from a world's own text (see
 * `resolveNarrativeMode`) — every other mode is always an explicit choice
 * (author-picked, or AI-classified from the story's own description).
 */
export type NarrativeMode =
  | 'dramatic'
  | 'gentle'
  | 'dark'
  | 'absurd'
  | 'melancholic'
  | 'mystery'
  | 'slice_of_life'
  | 'custom'

/** Tones that lean gentle on their own (still need corroboration to flip). */
const GENTLE_TONES = new Set(['Whimsical Fairy Tale'])

/**
 * Explicit "nothing bad here" declarations — any one of these in the world's
 * rules/lore/description is decisive on its own.
 */
const DECISIVE_PATTERNS = [
  /no\s+(bad|evil|villains?|violence|danger|darkness|harm|death)/,
  /nothing\s+(bad|evil|dark|scary)/,
  /(everyone|everything)\s+is\s+(good|kind|safe|happy)/,
  /no\s+conflict/,
  /(conflict|violence)[-\s]free/,
]

/** Softer signals — need at least two, plus an Everyone rating, to flip. */
const SOFT_KEYWORDS = ['gentle', 'cozy', 'wholesome', 'peaceful', 'kindness', 'comforting', 'soothing', 'heartwarming']

/**
 * Resolve a world's narrative mode. An explicit author setting
 * (`storySettings.narrativeMode`) always wins; otherwise the mode is derived
 * from the world's own context — its declared rules, lore, description, tone,
 * and rating — so a "no bad happens here" world is honored without the author
 * having to know the setting exists. Conservative by design: when in doubt,
 * stay dramatic (the traditional arc).
 */
export function resolveNarrativeMode(
  world: Pick<World, 'tone' | 'rules' | 'lore' | 'description' | 'rating'> & {
    storySettings?: { narrativeMode?: 'auto' | NarrativeMode }
  },
): NarrativeMode {
  const explicit = world.storySettings?.narrativeMode
  if (explicit === 'gentle' || explicit === 'dramatic') return explicit

  const text = `${world.rules ?? ''} ${world.lore ?? ''} ${world.description ?? ''}`.toLowerCase()

  if (DECISIVE_PATTERNS.some((p) => p.test(text))) return 'gentle'

  const softHits = SOFT_KEYWORDS.filter((k) => text.includes(k)).length
  const gentleTone = GENTLE_TONES.has(world.tone ?? '')
  if ((world.rating ?? 'Everyone') === 'Everyone' && (softHits >= 2 || (gentleTone && softHits >= 1))) {
    return 'gentle'
  }

  return 'dramatic'
}

/**
 * Resolve the EFFECTIVE mode for one story: a gentle world is law (its stories
 * can never be overridden dramatic — same clamp philosophy as content ratings),
 * while a dramatic world may host an individual gentle story via the story's
 * own `narrativeMode`.
 */
export function resolveStoryNarrativeMode(
  world: Parameters<typeof resolveNarrativeMode>[0],
  story?: { narrativeMode?: NarrativeMode },
): NarrativeMode {
  const worldMode = resolveNarrativeMode(world)
  if (worldMode === 'gentle') return 'gentle'
  return story?.narrativeMode ?? worldMode
}

/** Actions the cast may never take — or even plan — in a gentle world. */
const HOSTILE_ACTIONS = new Set(['social_betray', 'social_intimidate', 'combat_attack_player'])

/**
 * Strip hostility from a GOAP config for a gentle world: hostile actions leave
 * the action set, and goals that work AGAINST the protagonist are dropped. An
 * agent left goalless simply idles warmly (no planned action) — which is
 * exactly right for a world where nothing bad happens. Applied at the single
 * agent-registration chokepoint, so authored and default configs alike comply.
 */
export function gentleGoapFilter<
  T extends { goals: Array<{ sentiment?: string }>; availableActions: string[] },
>(config: T): T {
  return {
    ...config,
    goals: config.goals.filter((g) => g.sentiment !== 'anti_protagonist'),
    availableActions: config.availableActions.filter((a) => !HOSTILE_ACTIONS.has(a)),
  }
}

/**
 * The overriding instruction block for a gentle world — leads the system-driven
 * narrative events so it governs everything after it (encounters, pacing,
 * quests). Explicit about what tension means here, so the model doesn't
 * reintroduce conflict out of habit.
 */
export function gentleModeDirective(): string {
  return (
    'This is a GENTLE world: nothing bad happens here — no villains, threats, danger, malice, injury, or loss. ' +
    'Do not manufacture conflict. Momentum comes from anticipation, curiosity, warmth, and wonder: ' +
    'a festival being prepared, a friendship forming, something beautiful about to be revealed. ' +
    'Climaxes are moments of joy, connection, discovery, or achievement. ' +
    'End chapters on warm anticipation or a delightful choice, never peril.'
  )
}

/** The overriding instruction block for a DARK world — leads the system events. */
export function darkModeDirective(): string {
  return (
    'This is a DARK world: dread, moral cost, and consequences that do not get undone. ' +
    'Do not soften outcomes or guarantee a happy ending — victories are costly, compromises are real, ' +
    'and something is usually lost even when the protagonist "wins". ' +
    'Let unease build quietly between chapters, not just in overt threats. ' +
    'End chapters on a note of dread, grim resolve, or a choice with no clean option.'
  )
}

/** The overriding instruction block for an ABSURD world — leads the system events. */
export function absurdModeDirective(): string {
  return (
    'This is an ABSURD world: surreal and illogical, played with total deadpan sincerity. ' +
    'Everyone in the story treats the nonsense as completely normal — the comedy comes from that sincerity, ' +
    'never from characters winking at how silly it is. Let escalation compound: one absurdity invites the next. ' +
    'End chapters on a fresh, straight-faced absurdity or a delightfully illogical choice.'
  )
}

/** The overriding instruction block for a MELANCHOLIC world — leads the system events. */
export function melancholicModeDirective(): string {
  return (
    'This is a MELANCHOLIC world: quiet sorrow, wistfulness, and bittersweet longing. ' +
    'Nothing needs to be dangerous or morally costly — the ache comes from memory, distance, and things left ' +
    'unsaid or already lost. Let silences and small unspoken feelings carry weight. ' +
    'End chapters on a wistful, tender, or quietly aching note, rarely a clean resolution.'
  )
}

/** The overriding instruction block for a MYSTERY world — leads the system events. */
export function mysteryModeDirective(): string {
  return (
    'This is a MYSTERY world: something does not add up, and finding out is the point. ' +
    'Seed concrete clues and inconsistencies the protagonist can actually follow — not just vague unease. ' +
    'Let red herrings mislead without cheating the reader; every clue should make sense in hindsight. ' +
    'End chapters on a fresh clue, an unanswered question, or a suspicion sharpening.'
  )
}

/** The overriding instruction block for a SLICE-OF-LIFE world — leads the system events. */
export function sliceOfLifeModeDirective(): string {
  return (
    'This is a SLICE-OF-LIFE world: ordinary, human-scale, and low-stakes. ' +
    'Nothing looms — momentum comes from small routines, minor frictions, everyday texture, and quiet human ' +
    'moments. Let stakes stay genuinely small; even the biggest moment here is an ordinary one done well. ' +
    'End chapters on a small, grounded, true-to-life beat, never a cliffhanger or peril.'
  )
}

/** The mode-governing instruction block for `mode`, or '' for dramatic (no override needed). */
export function narrativeModeDirective(mode: NarrativeMode): string {
  switch (mode) {
    case 'gentle': return gentleModeDirective()
    case 'dark': return darkModeDirective()
    case 'absurd': return absurdModeDirective()
    case 'melancholic': return melancholicModeDirective()
    case 'mystery': return mysteryModeDirective()
    case 'slice_of_life': return sliceOfLifeModeDirective()
    default: return ''
  }
}
