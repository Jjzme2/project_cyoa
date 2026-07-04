import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import {
  getStory,
  getStoryNode,
  getWorld,
  createStory,
  createSagaTree,
  getUserSagaInWorld,
  incrementSagaBranches,
  getMultiverseEchoes,
  getLinkedEchoes,
  getMultiverseCameos,
  getLinkedCameos,
} from '@/lib/firestore-helpers'
import { mergeEchoes, mergeCameos } from '@/lib/multiverse'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generateSagaOpening, buildWorldContext, PromptRejectedError } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'
import { clampRating } from '@/lib/ratings'
import { analytics } from '@/lib/telemetry'

const BranchSchema = z.object({
  nodeId: z.string().min(1),
  nodeHistory: z.array(z.string()).max(60).optional(),
  prompt: z.string().trim().min(1, 'Write how your saga begins').max(1000),
})

/** Build a bounded recap of the chapters read so far, to seed the saga opening. */
async function recapPath(storyId: string, nodeIds: string[]): Promise<string> {
  const recent = nodeIds.slice(-5)
  const nodes = await Promise.all(recent.map((id) => getStoryNode(storyId, id).catch(() => null)))
  return nodes
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => n.content.replace(/\s+/g, ' ').trim().slice(0, 200))
    .join(' … ')
    .slice(0, 1200)
}

/**
 * Branch a personal saga off any chapter of a story. Seeded by the reader's
 * written prompt PLUS a recap of the path they've read, so it continues from
 * where they stepped in. This is a 4th branch type — it does not fill or count
 * as a community choice slot — and it bumps the source chapter's saga counter.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  let displayName: string | null
  let tier: 'FREE' | 'PREMIUM' = 'FREE'
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    if (decoded.firebase?.sign_in_provider === 'anonymous') {
      return NextResponse.json({ error: 'Create a free account to branch a saga.' }, { status: 403 })
    }
    uid = decoded.uid
    displayName = decoded.name ?? null
    tier = (decoded.tier as 'FREE' | 'PREMIUM') ?? 'FREE'
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { id: sourceStoryId } = await params
  const parsed = await parseJson(req, BranchSchema)
  if (!parsed.ok) return parsed.response
  const { nodeId, nodeHistory, prompt } = parsed.data

  const source = await getStory(sourceStoryId).catch(() => null)
  if (!source) return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  const world = await getWorld(source.worldId).catch(() => null)
  if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })

  // One saga per player, per world.
  const existing = await getUserSagaInWorld(uid, source.worldId).catch(() => null)
  if (existing) {
    return NextResponse.json(
      { error: 'You already have a saga in this world.', existingId: existing.id },
      { status: 409 },
    )
  }

  const effectiveRating = world.rating ? clampRating(source.rating ?? world.rating, world.rating) : (source.rating ?? 'Everyone')

  const credit = await CreditManager.consume(uid, tier, 1)
  if (!credit.success) return creditFailureResponse(credit)

  try {
    const [poolEchoes, linkEchoes, poolCameos, linkCameos, recap] = await Promise.all([
      world.multiverse?.id ? getMultiverseEchoes(world.multiverse.id, world.id, { maxRating: effectiveRating }).catch(() => []) : Promise.resolve([]),
      world.links?.length ? getLinkedEchoes(world.links, { maxRating: effectiveRating }).catch(() => []) : Promise.resolve([]),
      world.multiverse?.id ? getMultiverseCameos(world.multiverse.id, world.id, { maxRating: effectiveRating }).catch(() => []) : Promise.resolve([]),
      world.links?.length ? getLinkedCameos(world.links, { maxRating: effectiveRating }).catch(() => []) : Promise.resolve([]),
      recapPath(sourceStoryId, [...(nodeHistory ?? []), nodeId]),
    ])

    const worldCtx = buildWorldContext(world, {
      rating: effectiveRating,
      echoes: mergeEchoes(poolEchoes, linkEchoes),
      cameos: mergeCameos(poolCameos, linkCameos),
    })

    const sagaPremise = `You step into this world's story already in motion. ${prompt}`.slice(0, 1000)
    const entry = {
      label: 'Where you step in',
      premise: (recap ? `The tale so far: ${recap}. Now, your own path begins: ${prompt}` : prompt).slice(0, 600),
    }

    const opening = await generateSagaOpening(worldCtx, sagaPremise, entry, uid)

    const seededCast = (world.genesis?.characters ?? []).slice(0, 5).map((c) => ({
      name: c.name,
      description: [c.role, c.faction ? `of ${c.faction}` : '', c.bio].filter(Boolean).join(' · ').slice(0, 200),
      status: 'alive' as const,
    }))

    const sagaId = await createStory({
      title: `${source.title} — Your Saga`.slice(0, 120),
      description: prompt.slice(0, 200),
      worldId: source.worldId,
      worldName: world.name,
      authorId: uid,
      authorName: displayName ?? 'Anonymous',
      rootNodeId: null,
      published: true,
      coverGradient: 'from-purple-900 to-indigo-900',
      rating: effectiveRating,
      ratingOverriddenBy: null,
      resources: [],
      characters: seededCast,
      youMode: true,
      goapEnabled: true,
      implementQuests: false,
      // A reader's personal saga is private to their spaces by default.
      unlisted: true,
      tags: [],
    })

    await createSagaTree(
      sagaId,
      `Your story begins where another's left off.`,
      uid,
      [{ label: entry.label, content: opening.content, choices: opening.choices, aiModel: opening.model, location: opening.location, sceneAmbient: opening.sceneAmbient }],
    )

    revalidateTag('stories', 'max')
    revalidateTag(`node-${sourceStoryId}-${nodeId}`, 'max')
    after(() => incrementSagaBranches(sourceStoryId, nodeId).catch(() => {}))
    after(() => analytics.track('saga.branched', { uid, props: { sagaId, fromStoryId: sourceStoryId, fromNodeId: nodeId, worldId: source.worldId } }))
    trackGenerationCompleted({ kind: 'saga', credits: 1, source: credit.source, uid, context: { worldId: source.worldId, branchedFrom: sourceStoryId } })

    return NextResponse.json({ id: sagaId }, { status: 201 })
  } catch (error) {
    await CreditManager.refund(uid, tier, 1, credit.source).catch(() => {})
    const rejected = error instanceof PromptRejectedError
    trackGenerationFailed({ kind: 'saga', credits: 1, source: credit.source, uid, reason: rejected ? 'prompt_rejected' : 'model_error', context: { worldId: source.worldId } })
    if (rejected) return NextResponse.json({ error: `Your prompt was rejected: ${error.reason}` }, { status: 422 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to begin saga' }, { status: 503 })
  }
}
