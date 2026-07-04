import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAuthContext, requireRegisteredAccount } from '@/lib/auth'
import { getCharacter, setCharacterPortrait, getWorld } from '@/lib/firestore-helpers'
import { CreditManager } from '@/lib/credit-manager'
import { creditFailureResponse } from '@/lib/credit-response'
import { generatePortraitImage } from '@/lib/ai'
import { trackGenerationCompleted, trackGenerationFailed } from '@/lib/generation-telemetry'

const PORTRAIT_COST = 3

/**
 * Generate a portrait for a character and store it on the registry doc.
 * Credit-gated like cover-image generation. Only the character's owner (the
 * author for an author-scoped hero, or the world's author for a world figure)
 * or an admin may generate it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guestBlock = requireRegisteredAccount(auth)
  if (guestBlock) return NextResponse.json({ error: guestBlock }, { status: 403 })

  const { id } = await params
  const character = await getCharacter(id)
  if (!character) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  // Authorize: admin, the author who owns this hero, or the author of the world
  // this figure belongs to.
  let canEdit = auth.isAdmin || (character.scope === 'author' && character.ownerId === auth.uid)
  if (!canEdit && character.scope === 'world') {
    const world = await getWorld(character.ownerId).catch(() => null)
    canEdit = !!world && world.authorId === auth.uid
  }
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const credit = await CreditManager.consume(auth.uid, auth.tier, PORTRAIT_COST)
  if (!credit.success) return creditFailureResponse(credit)

  const blobKey = `${id}-${Date.now()}`
  const result = await generatePortraitImage(character.name, character.tagline, character.description, blobKey)

  if (!result.url) {
    await CreditManager.refund(auth.uid, auth.tier, PORTRAIT_COST, credit.source)
    trackGenerationFailed({ kind: 'portrait', credits: PORTRAIT_COST, source: credit.source, uid: auth.uid, reason: 'image_failed', context: { characterId: id } })
    return NextResponse.json({ error: result.error ?? 'Generation failed' }, { status: 503 })
  }

  await setCharacterPortrait(id, result.url)
  // Refresh the cached profile, directory, and any world cast showing this figure.
  revalidateTag('characters', 'max')

  trackGenerationCompleted({ kind: 'portrait', credits: PORTRAIT_COST, source: credit.source, uid: auth.uid, context: { characterId: id } })
  return NextResponse.json({ url: result.url, remaining: credit.remaining })
}
