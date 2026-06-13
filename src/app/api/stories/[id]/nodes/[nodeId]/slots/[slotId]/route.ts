import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
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
  getDecryptedUserApiKey,
  getStoryPath,
  createNotification,
  checkAndAwardAchievements,
  addStoryCharacters,
  settleBountyOnFill,
} from '@/lib/firestore-helpers'
import { CreditManager } from '@/lib/credit-manager'
import { generateStoryNode, generateStoryImage, PromptRejectedError } from '@/lib/ai'
import { validatePromptLocal } from '@/lib/validate'
import { moderateText, moderationToNodeFields } from '@/lib/moderation'

const IMAGE_CREDIT_COST = 3 // total credits when image is requested

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
    uid = decoded.uid
    displayName = decoded.name ?? null
    tier = (decoded.tier as 'FREE' | 'PREMIUM') ?? 'FREE'
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Read and locally validate the prompt before acquiring any lock or consuming credits
  const body = await req.json()
  const promptText: string = body.promptText ?? ''
  const includeImage: boolean = body.includeImage === true
  const requirements = body.requirements ?? []
  const effects = body.effects ?? []
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
      return NextResponse.json(
        { error: limitMsg, remaining: 0, reset: consumeResult.reset },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((consumeResult.reset - Date.now()) / 1000)) } },
      )
    }
    source = consumeResult.source
    consumed = true
    const { remaining, reset } = consumeResult

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
    const worldCtx = {
      name: world.name,
      description: world.description,
      lore: world.lore,
      rules: world.rules,
      tone: world.tone,
      rating: effectiveRating,
      protagonist: story.protagonist,
      characters: story.characters,
    }

    const { content, choices, model, newCharacters } = await generateStoryNode(
      worldCtx,
      storyPath,
      promptText,
      uid,
      includeImage,
    )

    // Moderate the generated prose. Hard-refuse disallowed content (release the
    // lock + refund); flag borderline content so the route is stored but hidden
    // from readers until an admin approves it.
    const verdict = moderateText(content, effectiveRating)
    if (verdict.action === 'refuse') {
      await Promise.all([
        releaseChoiceSlot(storyId, nodeId, slotId),
        CreditManager.refund(uid, tier, credits, source),
      ])
      return NextResponse.json(
        { error: verdict.reason ?? 'This content violates the community guidelines.' },
        { status: 422 },
      )
    }
    const moderationFields = moderationToNodeFields(verdict)
    const pendingReview = verdict.action === 'flag'

    // Generate image concurrently with Firestore work if requested
    const userApiKey = includeImage ? await getDecryptedUserApiKey(uid) : null
    const imagePlaceholder = `${storyId}-${slotId}-${Date.now()}`

    const [imageResult, newNodeId] = await Promise.all([
      includeImage
        ? generateStoryImage(worldCtx, content, promptText, imagePlaceholder, userApiKey ?? undefined)
        : Promise.resolve({ url: null, error: undefined }),
      createStoryNode(
        {
          storyId,
          content,
          depth: parentNode.depth + 1,
          parentId: parentNode.id,
          choiceText: promptText,
          authorId: uid,
          aiGenerated: true,
          aiModel: model,
          imageUrl: null,
        },
        choices,
        moderationFields,
      ),
    ])

    const imageUrl = imageResult.url
    const imageError = imageResult.error

    const patchOps: Promise<unknown>[] = [
      fillChoiceSlot(storyId, nodeId, slotId, newNodeId, uid, displayName ?? 'Anonymous', promptText, requirements, effects),
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
      // Record any new canon characters the AI introduced this chapter.
      if (newCharacters && newCharacters.length > 0) {
        ops.push(addStoryCharacters(storyId, newCharacters))
      }
      // Don't notify the author about a contribution that's hidden pending review.
      if (!pendingReview && story.authorId && story.authorId !== uid) {
        ops.push(
          createNotification(story.authorId, 'new_contribution', {
            storyId,
            storyTitle: story.title,
            nodeId: newNodeId,
            contributorName: displayName ?? 'Anonymous',
            slotPrompt: promptText,
          }),
        )
      }
      await Promise.all(ops).catch(() => {})
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

    if (error instanceof PromptRejectedError) {
      return NextResponse.json({ error: error.reason }, { status: 422 })
    }
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
