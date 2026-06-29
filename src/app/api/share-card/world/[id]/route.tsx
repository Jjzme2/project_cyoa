import { getWorld } from '@/lib/firestore-helpers'
import { renderShareCard } from '@/lib/share-card'

/**
 * Portrait Share Card for a world — a poster a creator can drop to invite
 * others in. 1080×1350 PNG (see {@link renderShareCard}).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const world = await getWorld(id).catch(() => null)
  if (!world) {
    return new Response('Not found', { status: 404 })
  }

  return renderShareCard({
    kind: 'world',
    eyebrow: world.tone || 'A world',
    title: world.name,
    subtitle: world.description,
    footerNote: world.multiverse ? world.multiverse.name : `by ${world.authorName}`,
  })
}
