import type { ContentRating, DirectorPersona, Protagonist, StoryCharacter, World } from '@/types'
import type { WorldContext, WorldEcho, CharacterCameo } from './prompts'

export interface WorldContextOptions {
  /** Effective content rating (e.g. a story's clamped rating); defaults to the world's own. */
  rating?: ContentRating
  protagonist?: Protagonist
  characters?: StoryCharacter[]
  director?: DirectorPersona
  /**
   * Legends to inject, ALREADY READ for this exact world. The caller is
   * responsible for fetching these with the same worldId as `world.id` — this
   * function never reaches out to the chronicle itself.
   */
  chronicle?: string[]
  /** This story/saga's picks for the world's configurable style options. */
  styleChoices?: Record<string, string>
  /**
   * Legends pooled from OTHER worlds in this world's multiverse, ALREADY READ by
   * the caller for this exact world's membership. Omitted for an unconnected
   * world — there is no implicit cross-world read here.
   */
  echoes?: WorldEcho[]
  /**
   * Notable figures from OTHER connected worlds who may cameo, ALREADY READ by
   * the caller for this exact world's declared connections. Omitted for an
   * unconnected world — no implicit cross-world read here.
   */
  cameos?: CharacterCameo[]
}

/**
 * The single, audited place that assembles a world's AI prompt context.
 *
 * Every field is derived from ONE already-loaded `world` document plus the
 * story-scoped extras the caller passes explicitly. There is deliberately no
 * worldId lookup and no Firestore read inside this function — so a caller can
 * only ever surface the world it loaded, never a second one. This is the
 * isolation guarantee: one world's lore, canon, chronicle, and style cannot leak
 * into another world's prompt, because the assembly seam has no way to reach a
 * different world's data. Cross-world content may only enter through an explicit,
 * declared connection (see the multiverse layer), never by accident here.
 */
export function buildWorldContext(world: World, opts: WorldContextOptions = {}): WorldContext {
  return {
    name: world.name,
    description: world.description,
    lore: world.lore,
    rules: world.rules,
    tone: world.tone,
    rating: opts.rating ?? world.rating,
    genesis: world.genesis,
    storySettings: world.storySettings,
    ...(opts.protagonist ? { protagonist: opts.protagonist } : {}),
    ...(opts.characters ? { characters: opts.characters } : {}),
    ...(opts.director ? { director: opts.director } : {}),
    ...(opts.chronicle ? { chronicle: opts.chronicle } : {}),
    ...(opts.styleChoices ? { styleChoices: opts.styleChoices } : {}),
    ...(opts.echoes && opts.echoes.length ? { echoes: opts.echoes } : {}),
    ...(opts.cameos && opts.cameos.length ? { cameos: opts.cameos } : {}),
  }
}
