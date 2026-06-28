import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { getWorld, setWorldMultiverse, resolveWorldLinks } from '@/lib/firestore-helpers'
import { toMultiverseId } from '@/lib/multiverse'

const Schema = z.object({
  multiverseName: z.string().optional(),
  links: z
    .array(z.object({ worldId: z.string().min(1), nexus: z.string().optional() }))
    .optional(),
})

/**
 * Update an EXISTING world's multiverse membership and explicit links, so worlds
 * created before the multiverse system (or any time) can opt in or out. Owner or
 * admin only. Stories inherit automatically — generation reads the live world doc.
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

  const multiverseName = parsed.data.multiverseName?.trim().slice(0, 60) || ''
  const multiverseId = multiverseName ? toMultiverseId(multiverseName) : null
  const multiverse = multiverseId ? { id: multiverseId, name: multiverseName } : null
  // Resolve links and never let a world link to itself.
  const links = await resolveWorldLinks(parsed.data.links ?? [], { excludeWorldId: id })

  await setWorldMultiverse(id, { multiverse, links: links.length ? links : null })

  revalidateTag('worlds', 'max')
  revalidateTag(`world-${id}`, 'max')

  return NextResponse.json({ ok: true, multiverse, links })
}
