import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { getWorld, setWorldGuestStars } from '@/lib/firestore-helpers'

const Schema = z.object({ characterIds: z.array(z.string().min(1)).max(5) })

/**
 * Set a world's hand-picked "guest star" Characters (Characters Fold 2d) —
 * independent of the multiverse/links system, which only surfaces figures
 * from explicitly CONNECTED worlds. Owner or admin only.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, Schema)
  if (!parsed.ok) return parsed.response

  const world = await getWorld(id)
  if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })
  if (world.authorId !== auth.uid && !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await setWorldGuestStars(id, parsed.data.characterIds)

  revalidateTag('worlds', 'max')
  revalidateTag(`world-${id}`, 'max')

  return NextResponse.json({ ok: true })
}
