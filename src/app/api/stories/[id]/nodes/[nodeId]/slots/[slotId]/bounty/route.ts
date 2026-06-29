import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { postBounty, cancelBounty, getStory } from '@/lib/firestore-helpers'

const BountySchema = z.object({
  reward: z.coerce.number(),
  promptHint: z.string().optional(),
})

/** Place a credit bounty on an empty slot (escrowed from purchased credits). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string; slotId: string }> },
) {
  const { id: storyId, nodeId, slotId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, BountySchema)
  if (!parsed.ok) return parsed.response

  // Sagas (the reader plays as themselves) don't carry bounties.
  const story = await getStory(storyId).catch(() => null)
  if (story?.youMode) {
    return NextResponse.json({ error: 'Sagas don’t support bounties.' }, { status: 400 })
  }

  const result = await postBounty(
    storyId,
    nodeId,
    slotId,
    { uid: auth.uid, name: auth.name ?? 'Anonymous' },
    parsed.data.reward,
    parsed.data.promptHint,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  revalidateTag(`node-${storyId}-${nodeId}`, 'max')
  return NextResponse.json({ ok: true })
}

/** Cancel an open, unclaimed bounty and refund the poster. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string; slotId: string }> },
) {
  const { id: storyId, nodeId, slotId } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await cancelBounty(storyId, nodeId, slotId, auth.uid)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  revalidateTag(`node-${storyId}-${nodeId}`, 'max')
  return NextResponse.json({ ok: true })
}
