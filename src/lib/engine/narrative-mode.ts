import type { World } from '@/types'

/**
 * The narrative SHAPE of a world's stories.
 *
 * The engine's default arc machinery is conflict-driven (threats, betrayals,
 * stakes) — right for most worlds, quietly wrong for a world whose author built
 * a place where nothing bad happens. In a `gentle` world the climax is a moment
 * of wonder, connection, or achievement rather than a confrontation, and
 * "tension" is anticipation rather than danger.
 *
 * `dramatic` — the traditional arc: conflict, stakes, reckonings (default).
 * `gentle`   — conflict-free: arcs of wonder, friendship, and shared joy; no
 *              villains, threats, or manufactured danger, ever.
 */
export type NarrativeMode = 'dramatic' | 'gentle'

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
