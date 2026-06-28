import { getStory, getStoryNode } from '@/lib/firestore-helpers'
import { renderShareCard, rarityStat, type ShareCardStat } from '@/lib/share-card'

/**
 * Portrait Share Card for a story, or — with `?node=<id>` — for a specific
 * ending a reader reached. Returns a 1080×1350 PNG meant to be saved and
 * posted, not a link preview (that's the opengraph-image route).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const nodeId = new URL(req.url).searchParams.get('node')

  const story = await getStory(id).catch(() => null)
  if (!story) {
    return new Response('Not found', { status: 404 })
  }

  // Ending card: a specific node the reader finished on.
  if (nodeId) {
    const node = await getStoryNode(id, nodeId).catch(() => null)
    if (node) {
      const stats: ShareCardStat[] = []
      const rarity = rarityStat(node.traversals, story.views)
      if (rarity) stats.push(rarity)
      stats.push({ value: `${node.depth + 1}`, label: node.depth === 0 ? 'chapter' : 'chapters deep' })

      return renderShareCard({
        kind: 'ending',
        eyebrow: 'An ending of',
        title: story.title,
        subtitle: node.choiceText ? `“${node.choiceText}”` : story.description,
        imageUrl: node.imageUrl ?? undefined,
        stats,
        footerNote: `in ${story.worldName}`,
      })
    }
  }

  // Story card (default).
  return renderShareCard({
    kind: 'story',
    eyebrow: story.worldName,
    title: story.title,
    subtitle: story.description,
    stats: story.views > 0 ? [{ value: story.views.toLocaleString('en-US'), label: 'reads' }] : undefined,
    footerNote: `by ${story.authorName}`,
  })
}
