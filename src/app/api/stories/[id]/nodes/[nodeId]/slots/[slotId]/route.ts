import { NextRequest, NextResponse } from 'next/server'
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
} from '@/lib/firestore-helpers'
import { checkRateLimit, refundRateLimit } from '@/lib/rate-limit'
import { generateStoryNode, generateStoryImage, PromptRejectedError } from '@/lib/ai'
import { validatePromptLocal } from '@/lib/validate'

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

  const { success, remaining, reset } = await checkRateLimit(uid, tier, credits)
  if (!success) {
    await releaseChoiceSlot(storyId, nodeId, slotId)
    const limitMsg = includeImage
      ? `Not enough daily credits for text+image (need ${credits}). Come back tomorrow!`
      : 'Daily AI limit reached. Come back tomorrow!'
    return NextResponse.json(
      { error: limitMsg, remaining: 0, reset },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) } },
    )
  }

  const [slot, parentNode, story, storyPath] = await Promise.all([
    getChoiceSlot(storyId, nodeId, slotId),
    getStoryNode(storyId, nodeId),
    getStory(storyId),
    getStoryPath(storyId, nodeId),
  ])

  if (!slot) {
    await releaseChoiceSlot(storyId, nodeId, slotId)
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
  }
  if (!parentNode) {
    await releaseChoiceSlot(storyId, nodeId, slotId)
    return NextResponse.json({ error: 'Parent node not found' }, { status: 404 })
  }
  if (!story) {
    await releaseChoiceSlot(storyId, nodeId, slotId)
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  const world = story.worldId ? await getWorld(story.worldId) : null
  if (!world) {
    await releaseChoiceSlot(storyId, nodeId, slotId)
    return NextResponse.json({ error: 'World not found' }, { status: 404 })
  }

  const worldCtx = {
    name: world.name,
    description: world.description,
    lore: world.lore,
    rules: world.rules,
    tone: world.tone,
  }

  try {
    const { content, choices, model } = await generateStoryNode(
      worldCtx,
      storyPath,
      promptText,
      uid,
      includeImage,
    )

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
          imageUrl: null, // will be patched below once image URL is known
        },
        choices,
      ),
    ])

    const imageUrl = imageResult.url
    const imageError = imageResult.error

    const patchOps: Promise<unknown>[] = [
      fillChoiceSlot(storyId, nodeId, slotId, newNodeId, uid, displayName ?? 'Anonymous', promptText, requirements, effects),
      incrementStoryNodeCount(storyId),
    ]
    
    let finalRemaining = remaining
    // Patch image URL if generation succeeded
    if (imageUrl) {
      patchOps.push(
        adminDb.collection('stories').doc(storyId).collection('nodes').doc(newNodeId).update({ imageUrl }),
      )
    } else if (includeImage) {
      // Refund the 2 extra image credits since image generation failed, leaving them charged only 1 credit for text
      const refundAmount = IMAGE_CREDIT_COST - 1
      patchOps.push(refundRateLimit(uid, tier, refundAmount))
      finalRemaining = remaining + refundAmount
    }
    await Promise.all(patchOps)

    return NextResponse.json(
      { nodeId: newNodeId, content, choices, model, imageUrl, remaining: finalRemaining, imageError },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof PromptRejectedError) {
      await Promise.all([
        releaseChoiceSlot(storyId, nodeId, slotId),
        refundRateLimit(uid, tier, credits),
      ])
      return NextResponse.json({ error: error.reason }, { status: 422 })
    }

    await Promise.all([
      releaseChoiceSlot(storyId, nodeId, slotId),
      refundRateLimit(uid, tier, credits),
    ])
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
