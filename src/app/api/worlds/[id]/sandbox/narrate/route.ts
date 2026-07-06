import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext, requireRegisteredAccount } from '@/lib/auth'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { getWorld } from '@/lib/firestore-helpers'
import { resolveNarrativeMode } from '@/lib/engine/narrative-mode'
import { generateStoryNode, buildWorldContext } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'
import { sanitizeDirector } from '@/lib/director'
import type { StoryPathSegment } from '@/types'

const MAX_SCENES = 24

const SceneSchema = z.object({
  content: z.string().max(4000),
  choiceText: z.string().max(300).nullable(),
  depth: z.number().int().min(0).max(1000),
})

const NarrateSchema = z
  .object({
    playerMode: z.enum(['hero', 'god']),
    hero: z
      .object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(300).optional() })
      .optional(),
    // Only meaningful in 'god' mode — see the framing text below.
    godAwareness: z.enum(['hidden', 'known']).default('hidden'),
    action: z.string().trim().min(1).max(300),
    storyPath: z.array(SceneSchema).max(MAX_SCENES).default([]),
    // Client-computed "Living World" pulse/stakes text (same pure functions the
    // rest of Sandbox v1 already uses) — folded in as system narrative context
    // rather than re-derived server-side, since the sandbox's live state never
    // touches Firestore.
    sandboxBriefing: z.string().max(2000).optional(),
    // Only meaningful in 'god' mode — an optional directorial tone override.
    // Untrusted; clamped by sanitizeDirector below (same as the authoring UI).
    director: z.unknown().optional(),
  })
  .refine((v) => v.playerMode !== 'hero' || !!v.hero?.name, {
    message: 'A hero needs a name first.',
    path: ['hero'],
  })

/**
 * On-demand, credit-costed AI narration for World Sandbox v2 — a real chapter
 * generation call (same `generateStoryNode` the live per-chapter path uses),
 * but nothing here is ever persisted: no Story, no StoryNode, no ChoiceSlot.
 * The sandbox's scene log lives entirely client-side and is resent each turn.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guestBlock = requireRegisteredAccount(auth)
  if (guestBlock) return NextResponse.json({ error: guestBlock }, { status: 403 })

  const parsed = await parseJson(req, NarrateSchema)
  if (!parsed.ok) return parsed.response
  const { playerMode, hero, godAwareness, action, storyPath, sandboxBriefing, director } = parsed.data

  const world = await getWorld(id).catch(() => null)
  if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })

  const credit = await CreditManager.consume(auth.uid, auth.tier, 1)
  if (!credit.success) return creditFailureResponse(credit)

  try {
    const narrativeMode = resolveNarrativeMode(world)
    const sanitizedDirector = playerMode === 'god' ? sanitizeDirector(director) : null
    const worldCtx = buildWorldContext(world, {
      narrativeMode,
      ...(playerMode === 'hero' && hero ? { protagonist: { name: hero.name, description: hero.description } } : {}),
      ...(sanitizedDirector ? { director: sanitizedDirector } : {}),
    })

    // God mode has no personal protagonist — the reader is an unseen hand
    // shaping the world, not a character in the scene, so the framing has to
    // say so explicitly or the model will default to a close personal POV.
    // `godAwareness` further decides whether the world's own people ever
    // notice: 'hidden' narrates the same event as ordinary happenstance,
    // 'known' lets characters address, question, resist, or revere the god.
    const godFraming =
      playerMode === 'god'
        ? "The reader is an unseen god shaping this world from beyond — there is no protagonist and no personal point of view. Narrate in sweeping, omniscient third person: the consequence of the god's intervention rippling across the world, its factions, and its people. " +
          (godAwareness === 'known'
            ? 'The people of this world CAN perceive the god — let at least one character address, question, resist, plead with, or revere the god directly, as a real presence acting on them.'
            : 'The people of this world have NO idea a god exists or is shaping anything — narrate every consequence as if it arose naturally from the world itself; no character may sense, suspect, or acknowledge a god.')
        : ''
    const systemNarrativeEvents = [godFraming, sandboxBriefing].filter(Boolean).join('\n\n')

    const syntheticPath: StoryPathSegment[] = storyPath.map((s, i) => ({
      id: `sandbox-${i}`,
      content: s.content,
      choiceText: s.choiceText,
      depth: s.depth,
    }))

    const result = await generateStoryNode(worldCtx, syntheticPath, action, auth.uid, false, systemNarrativeEvents)

    trackGenerationCompleted({ kind: 'sandbox', credits: 1, source: credit.source, uid: auth.uid, context: { worldId: id, playerMode } })
    return NextResponse.json({ content: result.content, choices: result.choices, remaining: credit.remaining })
  } catch (error) {
    await CreditManager.refund(auth.uid, auth.tier, 1, credit.source)
    trackGenerationFailed({ kind: 'sandbox', credits: 1, source: credit.source, uid: auth.uid, reason: 'model_error', context: { worldId: id, playerMode } })
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
