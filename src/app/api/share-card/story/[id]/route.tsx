import { getStory, getStoryNode } from '@/lib/firestore-helpers'
import { renderShareCard, rarityStat, type ShareCardStat } from '@/lib/share-card'
import type { EndingType } from '@/types'

/** Per-ending-type label + accent for the share card (mirrors the in-app reveal). */
const ENDING_CARD_META: Record<EndingType, { label: string; accent: string }> = {
  triumphant: { label: 'A triumphant ending', accent: '#f5d896' },
  tragic: { label: 'A tragic ending', accent: '#f08a8a' },
  bittersweet: { label: 'A bittersweet ending', accent: '#c4a3e8' },
  mysterious: { label: 'A mysterious ending', accent: '#7fd1d1' },
  secret: { label: 'A secret ending', accent: '#6ee7b7' },
}

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

      // A definitive, typed ending gets its own title, type label, and colour —
      // the high-virality share card. Falls back to the generic ending framing.
      const meta = node.isEnding && node.endingType ? ENDING_CARD_META[node.endingType] : null

      return renderShareCard({
        kind: 'ending',
        eyebrow: meta ? meta.label : 'An ending of',
        title: node.isEnding && node.endingTitle ? node.endingTitle : story.title,
        subtitle: node.isEnding && node.endingTitle ? `${story.title} · ${story.worldName}` : (node.choiceText ? `“${node.choiceText}”` : story.description),
        imageUrl: node.imageUrl ?? undefined,
        stats,
        footerNote: `in ${story.worldName}`,
        ...(meta ? { accent: meta.accent } : {}),
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
