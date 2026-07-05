import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import {
  getChoiceSlot,
  getStoryNode,
  getStory,
  getWorld,
  createStoryNode,
  fillChoiceSlot,
  incrementStoryNodeCount,
  lockChoiceSlot,
  releaseChoiceSlot,
  getStoryPath,
  createNotification,
  checkAndAwardAchievements,
  addStoryCharacters,
  settleBountyOnFill,
  getWorldStanding,
  updateWorldStanding,
  getWorldOutsiderRegard,
  updateWorldOutsiderRegard,
  getWorldChronicle,
  appendWorldChronicle,
  getMultiverseEchoes,
  getLinkedEchoes,
  getMultiverseCameos,
  getLinkedCameos,
  getGuestStarCameos,
} from '@/lib/firestore-helpers'
import { mergeEchoes, mergeCameos } from '@/lib/multiverse'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateStoryNode, generateStoryImage, judgeContent, buildWorldContext, PromptRejectedError } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'
import type { ModerationResult } from '@/lib/moderation'
import { validatePromptLocal } from '@/lib/validate'
import { moderateText, moderationToNodeFields } from '@/lib/moderation'
import { NarrativeBuilder } from '@/lib/engine/narrative-builder'
import { buildWorldPulse } from '@/lib/engine/world-pulse'
import { endingDirective } from '@/lib/engine/ending'
import { resolveStoryNarrativeMode } from '@/lib/engine/narrative-mode'
import type { WorldPulse } from '@/types'
import type { WorldState } from '@/types/goap'
import type { AgentMemory } from '@/types/goap'
import { ENDING_TYPES, type ChoiceRequirement, type ChoiceEffect } from '@/types'

const IMAGE_CREDIT_COST = 3 // total credits when image is requested

// requirements/effects/worldState were passed through untyped; `z.custom`
// preserves that while the fields the handler reads are validated and defaulted.
const FillSlotSchema = z.object({
  promptText: z.string().default(''),
  // Any non-`true` value (or absence) means "no image", as before.
  includeImage: z.boolean().catch(false),
  requirements: z.custom<ChoiceRequirement[]>().optional(),
  effects: z.custom<ChoiceEffect[]>().optional(),
  worldState: z.custom<WorldState>().optional(),
  // Author win/lose condition met on the reader's side → force a definitive
  // ending of this type/title (the conditions are the author's own, so trusting
  // the client signal here only lets a reader end their own playthrough).
  forceEnding: z.object({ type: z.enum(ENDING_TYPES), title: z.string().trim().min(1).max(80) }).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string; slotId: string }> },
) {
  const { id: storyId, nodeId, slotId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  let displayName: string | null
  let tier: 'FREE' | 'PREMIUM' = 'FREE'
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.firebase?.sign_in_provider === 'anonymous') {
      return NextResponse.json({ error: 'Create a free account to write a path.' }, { status: 403 })
    }
    uid = decoded.uid
    displayName = decoded.name ?? null
    tier = (decoded.tier as 'FREE' | 'PREMIUM') ?? 'FREE'
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Read and locally validate the prompt before acquiring any lock or consuming credits
  const parsed = await parseJson(req, FillSlotSchema)
  if (!parsed.ok) return parsed.response
  const { promptText, includeImage, forceEnding } = parsed.data
  const requirements = parsed.data.requirements ?? []
  const effects = parsed.data.effects ?? []
  const worldState: WorldState = parsed.data.worldState ?? {}
  const credits = includeImage ? IMAGE_CREDIT_COST : 1

  if (!promptText.trim()) {
    return NextResponse.json({ error: 'Prompt text required' }, { status: 400 })
  }

  const localCheck = validatePromptLocal(promptText)
  if (!localCheck.valid) {
    return NextResponse.json({ error: localCheck.reason }, { status: 422 })
  }

  // Lock slot atomically — prevents race conditions between concurrent writers
  const lockResult = await lockChoiceSlot(storyId, nodeId, slotId, uid)
  if (lockResult === 'filled') {
    return NextResponse.json({ error: 'Slot already filled' }, { status: 409 })
  }
  if (lockResult === 'locked') {
    return NextResponse.json(
      { error: 'Another storyteller is already writing this path. Try a different slot.' },
      { status: 409 },
    )
  }

  // Everything from here holds the lock. Any unexpected throw must release it.
  let source: 'daily' | 'purchased' = 'daily'
  let consumed = false

  try {
    const consumeResult = await CreditManager.consume(uid, tier, credits)
    if (!consumeResult.success) {
      await releaseChoiceSlot(storyId, nodeId, slotId)
      const limitMsg = includeImage
        ? `Not enough credits for text+image (need ${credits}). Purchase more or try again tomorrow!`
        : 'Daily AI limit reached. Purchase more credits or try again tomorrow!'
      return creditFailureResponse(consumeResult, { insufficientMessage: limitMsg, extra: { remaining: 0 } })
    }
    source = consumeResult.source
    consumed = true
    const { remaining } = consumeResult

    // These were previously unprotected — any throw here escaped to Next.js's
    // error boundary and returned HTML, causing the lock to never be released.
    const [slot, parentNode, story, storyPath] = await Promise.all([
      getChoiceSlot(storyId, nodeId, slotId),
      getStoryNode(storyId, nodeId),
      getStory(storyId),
      getStoryPath(storyId, nodeId),
    ])

    if (!slot) {
      await Promise.all([releaseChoiceSlot(storyId, nodeId, slotId), CreditManager.refund(uid, tier, credits, source)])
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }
    if (!parentNode) {
      await Promise.all([releaseChoiceSlot(storyId, nodeId, slotId), CreditManager.refund(uid, tier, credits, source)])
      return NextResponse.json({ error: 'Parent node not found' }, { status: 404 })
    }
    if (!story) {
      await Promise.all([releaseChoiceSlot(storyId, nodeId, slotId), CreditManager.refund(uid, tier, credits, source)])
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    const world = story.worldId ? await getWorld(story.worldId) : null
    if (!world) {
      await Promise.all([releaseChoiceSlot(storyId, nodeId, slotId), CreditManager.refund(uid, tier, credits, source)])
      return NextResponse.json({ error: 'World not found' }, { status: 404 })
    }

    // The story's rating is the effective ceiling (it's clamped to its world).
    const effectiveRating = story.rating ?? world.rating ?? 'Mature'
    // "You" mode: the reader is the protagonist, written by their own name.
    const youMode = !!story.youMode
    const protagonist =
      youMode && displayName
        ? { name: displayName, description: 'the reader, playing as themselves' }
        : story.protagonist
    // The world's chronicle is shared lore — injected for every story so
    // characters are aware of the legends that prior personal sagas wrote.
    const chronicle = await getWorldChronicle(story.worldId).catch(() => [])
    // Multiverse pool: only if THIS world opted into a multiverse do we draw a
    // few legends from its sibling worlds — surfaced as clearly-foreign echoes.
    // An unconnected world is never queried, so nothing crosses in.
    const [poolEchoes, linkEchoes, poolCameos, linkCameos, guestStarCameos] = await Promise.all([
      world.multiverse?.id
        ? getMultiverseEchoes(world.multiverse.id, story.worldId, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
      world.links?.length
        ? getLinkedEchoes(world.links, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
      // Character cameos: same opt-in gating as echoes (figures from connected
      // worlds may rarely cross in). An unconnected world is never queried.
      world.multiverse?.id
        ? getMultiverseCameos(world.multiverse.id, story.worldId, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
      world.links?.length
        ? getLinkedCameos(world.links, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
      // Hand-picked guest stars (Fold 2d) — independent of any connection.
      world.guestStarCharacterIds?.length
        ? getGuestStarCameos(world.guestStarCharacterIds, { maxRating: effectiveRating }).catch(() => [])
        : Promise.resolve([]),
    ])
    const echoes = mergeEchoes(poolEchoes, linkEchoes)
    const cameos = mergeCameos(poolCameos, linkCameos, guestStarCameos)
    // Assembled through the single audited seam (buildWorldContext): the chronicle
    // is read with story.worldId and passed in here, so only THIS world's legends
    // can reach the prompt — never another world's (save for declared echoes above).
    // The story's effective narrative shape, clamped by the world (a gentle
    // world is law; a dramatic world may host an individual gentle story).
    const storyMode = resolveStoryNarrativeMode(world, story)
    const worldCtx = buildWorldContext(world, {
      narrativeMode: storyMode,
      rating: effectiveRating,
      protagonist,
      characters: story.characters,
      director: story.director,
      chronicle: chronicle.map((e) => e.text),
      styleChoices: story.styleChoices,
      echoes,
      cameos,
    })

    // The narrative engine runs for EVERY story now. Its always-on subsystems —
    // the AI Director (pacing/tension beats), procedural environment & encounters,
    // and the autonomous faction + economy sim — need no per-story config. GOAP
    // agents and procedural quests remain opt-in: they stay gated inside the
    // builder by `goapEnabled` / `implementQuests`. (No extra AI call — the
    // context is folded into the single generation below.)
    let systemNarrativeEvents = ''
    let updatedEngineState = undefined
    let nodeWorldPulse: WorldPulse | undefined = undefined
    {
      // Restore prior engine state from the parent node (server-side, not client-trusted)
      const priorEngineState = parentNode.engineState ?? undefined
      const builder = new NarrativeBuilder(story, world, priorEngineState)
      const pathString = storyPath.map(p => p.id).join('_')
      // Carry world facts forward for continuity: seed from the story's initial
      // state, layer the parent node's persisted state, then any client deltas.
      const effectiveWorldState: WorldState = {
        ...(story.initialWorldState ?? {}),
        ...(priorEngineState?.worldState ?? {}),
        ...worldState,
      }
      // Living world: catch the autonomous systems up by ~1 tick per hour since
      // the parent chapter (capped), so the world feels like it moved on while
      // the reader was away.
      const ageMs = Date.now() - new Date(parentNode.createdAt).getTime()
      const catchUpTicks = Math.min(10, Math.floor(ageMs / 3_600_000))
      // "You" mode: seed NPC attitudes from the reader's personal standing here,
      // and from the world's COLLECTIVE regard for outsiders (the reader is one).
      const [readerStanding, outsiderRegard] = youMode
        ? await Promise.all([
            getWorldStanding(uid, story.worldId),
            getWorldOutsiderRegard(story.worldId).then((r) => r.regard),
          ])
        : [0, 0]
      const { context, updatedEngineState: nextState } = builder.buildContext(
        pathString,
        parentNode.depth + 1,
        effectiveWorldState,
        priorEngineState,
        catchUpTicks,
        readerStanding,
        outsiderRegard,
      )
      systemNarrativeEvents = builder.formatForPrompt(context)
      updatedEngineState = nextState
      // Reader-facing snapshot of the living world at this chapter.
      nodeWorldPulse = buildWorldPulse(context, nextState, storyMode)
    }

    // An author win/lose condition met on the reader's side FORCES a conclusion;
    // otherwise the engine may merely INVITE one (rare, earned — see
    // endingDirective). The model writes the final chapter either way.
    const endDirective = forceEnding
      ? `a definitive ${forceEnding.type} ending has been reached. Conclude the story NOW with a final chapter that lands this ${forceEnding.type} ending titled "${forceEnding.title}".`
      : endingDirective(parentNode.depth + 1, updatedEngineState, storyMode)

    // Validation (does this choice even make sense?), typo/grammar correction,
    // and chapter generation all happen in this ONE call — the model emits a
    // REJECTED line to void an illegitimate choice, or a corrected CHOICE_TEXT
    // line before writing (see buildPrompt/parseAIResponse). This replaces what
    // used to be a separate "Editor" round-trip before generation ever started.
    const { content, choices, model, newCharacters, location, sceneAmbient, ending, correctedChoiceText } =
      await generateStoryNode(
        worldCtx,
        storyPath,
        promptText.trim(),
        uid,
        includeImage,
        systemNarrativeEvents,
        endDirective,
      )
    const editedPrompt = correctedChoiceText ?? promptText.trim()

    // Moderate the generated prose. The rules-based check is the reliable floor;
    // the AI Content Judge can only escalate it (flag/refuse), never loosen it —
    // defense in depth. It also returns a craft score we persist for ranking.
    const rulesVerdict = moderateText(content, effectiveRating)
    const judgment = await judgeContent(content, editedPrompt, worldCtx, uid, (story.characters ?? []).map((c) => c.name)).catch(() => null)
    const SEVERITY: Record<string, number> = { allow: 0, flag: 1, refuse: 2 }
    const verdict: ModerationResult =
      judgment && SEVERITY[judgment.safety.action] > SEVERITY[rulesVerdict.action]
        ? judgment.safety
        : rulesVerdict
    const qualityScore = judgment?.quality.score
    if (verdict.action === 'refuse') {
      await Promise.all([
        releaseChoiceSlot(storyId, nodeId, slotId),
        CreditManager.refund(uid, tier, credits, source),
      ])
      trackGenerationFailed({ kind: 'chapter', credits, source, uid, reason: 'refused', context: { storyId } })
      return NextResponse.json(
        { error: verdict.reason ?? 'This content violates the community guidelines.' },
        { status: 422 },
      )
    }
    const moderationFields = moderationToNodeFields(verdict)
    const pendingReview = verdict.action === 'flag'

    // Intelligently fold the written action's consequences into the persisted
    // simulation: the Content Judge infers how named characters' regard shifted
    // from what actually happened (no manual memory editing). Applied to the
    // child node's engine state so the next chapter reflects it.
    let deepBondFormed = false
    if (updatedEngineState && judgment?.relationshipShifts?.length) {
      const known = new Map((story.characters ?? []).map((c) => [c.name.toLowerCase(), c.name]))
      for (const shift of judgment.relationshipShifts) {
        const name = known.get(shift.name.toLowerCase())
        if (!name || !shift.delta) continue
        if (updatedEngineState.relationships) {
          const cur = updatedEngineState.relationships.affinity[name] ?? 0
          const next = Math.max(-1, Math.min(1, Math.round((cur + shift.delta) * 100) / 100))
          updatedEngineState.relationships.affinity[name] = next
          if (next >= 0.8) deepBondFormed = true
        }
        const mems: AgentMemory[] = updatedEngineState.agentMemories[name] ?? []
        mems.push({
          event: shift.delta >= 0 ? 'The protagonist earned their regard.' : 'The protagonist wronged them.',
          nodeId,
          sentiment: shift.delta >= 0 ? 'positive' : 'negative',
          decayWeight: 1,
        })
        updatedEngineState.agentMemories[name] = mems.slice(-12)
      }
    }

    // Generate image concurrently with Firestore work if requested
    const imagePlaceholder = `${storyId}-${slotId}-${Date.now()}`

    const [imageResult, newNodeId] = await Promise.all([
      includeImage
        ? generateStoryImage(worldCtx, content, editedPrompt, imagePlaceholder)
        : Promise.resolve({ url: null, error: undefined }),
      createStoryNode(
        {
          storyId,
          content,
          depth: parentNode.depth + 1,
          parentId: parentNode.id,
          choiceText: editedPrompt,
          authorId: uid,
          aiGenerated: true,
          aiModel: model,
          imageUrl: null,
          ...(qualityScore !== undefined ? { qualityScore } : {}),
          ...(location ? { location } : {}),
          ...(sceneAmbient ? { sceneAmbient } : {}),
          ...(updatedEngineState ? { engineState: updatedEngineState } : {}),
          ...(nodeWorldPulse ? { worldPulse: nodeWorldPulse } : {}),
          // A forced (author-condition) ending is guaranteed terminal even if the
          // model omitted the marker; otherwise use what the model emitted.
          ...((ending ?? (forceEnding ? { title: forceEnding.title, type: forceEnding.type } : undefined))
            ? {
                isEnding: true,
                endingTitle: (ending ?? forceEnding!).title,
                endingType: (ending ?? forceEnding!).type,
              }
            : {}),
        },
        choices,
        moderationFields,
      ),
    ])

    const imageUrl = imageResult.url
    const imageError = imageResult.error

    const patchOps: Promise<unknown>[] = [
      fillChoiceSlot(storyId, nodeId, slotId, newNodeId, uid, displayName ?? 'Anonymous', editedPrompt, requirements, effects),
      incrementStoryNodeCount(storyId),
    ]

    let finalRemaining = remaining
    if (imageUrl) {
      patchOps.push(
        adminDb.collection('stories').doc(storyId).collection('nodes').doc(newNodeId).update({ imageUrl }),
      )
    } else if (includeImage) {
      const refundAmount = IMAGE_CREDIT_COST - 1
      patchOps.push(CreditManager.refund(uid, tier, refundAmount, source))
      finalRemaining = remaining + refundAmount
      // The chapter text still succeeded; only the illustration failed. Record
      // it as a (refunded) cover failure so image flakiness is measurable.
      trackGenerationFailed({ kind: 'cover', credits: refundAmount, source, uid, reason: 'image_failed', context: { storyId } })
    }
    await Promise.all(patchOps)

    // Settle any bounty on this slot: pay the filler if published, defer if
    // flagged, refund if they filled their own. (Money path — kept in-request.)
    if (slot.bounty && slot.bounty.status === 'open') {
      await settleBountyOnFill(storyId, nodeId, slotId, uid, newNodeId, !pendingReview).catch((e) =>
        console.error('[bounty settle] failed:', e),
      )
    }

    revalidateTag(`node-${storyId}-${nodeId}`, 'max')
    revalidateTag(`story-${storyId}`, 'max')
    revalidateTag('stories', 'max')
    revalidateTag(`story-tree-${storyId}`, 'max')

    after(async () => {
      const ops: Promise<unknown>[] = [checkAndAwardAchievements(uid, 'contribution')]
      if (includeImage && imageUrl) ops.push(checkAndAwardAchievements(uid, 'illustration'))
      if (deepBondFormed) ops.push(checkAndAwardAchievements(uid, 'npc_bond'))
      // Record any new canon characters the AI introduced this chapter.
      if (newCharacters && newCharacters.length > 0) {
        ops.push(addStoryCharacters(storyId, newCharacters))
      }
      // "You" mode: carry the world's regard for this reader forward so it
      // persists into the next story here. Prefer the Content Judge's reading of
      // the protagonist's CONDUCT this chapter (the reader's actual deeds); fall
      // back to the cast's net regard if the judge was unavailable.
      if (youMode) {
        let observed: number | null = judgment ? judgment.conduct : null
        if (observed === null && updatedEngineState?.relationships) {
          const aff = Object.values(updatedEngineState.relationships.affinity)
          if (aff.length > 0) observed = aff.reduce((s, v) => s + v, 0) / aff.length
        }
        if (observed !== null) {
          ops.push(
            updateWorldStanding(uid, story.worldId, observed, displayName ?? undefined).then((standing) =>
              checkAndAwardAchievements(uid, 'world_standing', { standing }),
            ),
          )
          // The same deed also shifts the world's COLLECTIVE regard for outsiders
          // (the reader is one) — slowly, so the whole people's opinion is the sum
          // of many sagas, not any single one.
          ops.push(
            updateWorldOutsiderRegard(story.worldId, observed).then(() =>
              revalidateTag(`world-outsiders-${story.worldId}`, 'max'),
            ),
          )
        }

        // A genuinely notable deed enters the world chronicle — shared lore that
        // every future story (and its NPCs) in this world will know.
        if (judgment?.legend && Math.abs(judgment.conduct) >= 0.6) {
          ops.push(
            appendWorldChronicle(story.worldId, {
              text: judgment.legend,
              byName: displayName ?? 'A wanderer',
              conduct: judgment.conduct,
              storyId,
              at: new Date().toISOString(),
            }),
          )
        }
      }
      // Don't notify the author about a contribution that's hidden pending review.
      if (!pendingReview && story.authorId && story.authorId !== uid) {
        ops.push(
          createNotification(story.authorId, 'new_contribution', {
            storyId,
            storyTitle: story.title,
            nodeId: newNodeId,
            contributorName: displayName ?? 'Anonymous',
            slotPrompt: editedPrompt,
          }),
        )
      }
      await Promise.all(ops).catch(() => {})
    })

    // Net credits actually charged: the image's surcharge is refunded when it
    // fails, so a text-only-after-image-failure chapter costs just the text.
    const chargedCredits = includeImage && !imageUrl ? credits - (IMAGE_CREDIT_COST - 1) : credits
    trackGenerationCompleted({
      kind: 'chapter',
      credits: chargedCredits,
      source,
      uid,
      context: { storyId, includeImage, imageGenerated: !!imageUrl, pendingReview },
    })

    return NextResponse.json(
      { nodeId: newNodeId, content, choices, model, imageUrl, remaining: finalRemaining, imageError, pendingReview },
      { status: 201 },
    )
  } catch (error) {
    // Single, unconditional cleanup for all error paths — prevents orphaned locks
    await Promise.all([
      releaseChoiceSlot(storyId, nodeId, slotId),
      consumed ? CreditManager.refund(uid, tier, credits, source) : Promise.resolve(),
    ]).catch(() => {}) // best-effort cleanup; don't mask the original error

    // Only count it as a failed generation if the writer was actually charged
    // (a pre-credit throw isn't a wasted generation).
    if (consumed) {
      trackGenerationFailed({
        kind: 'chapter',
        credits,
        source,
        uid,
        reason: error instanceof PromptRejectedError ? 'prompt_rejected' : 'model_error',
        context: { storyId },
      })
    }

    if (error instanceof PromptRejectedError) {
      return NextResponse.json({ error: error.reason }, { status: 422 })
    }
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
