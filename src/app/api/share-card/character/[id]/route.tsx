import { getCharacter } from '@/lib/firestore-helpers'
import { renderShareCard, type ShareCardStat } from '@/lib/share-card'
import { appearanceSummary } from '@/lib/characters'

/**
 * Portrait Share Card for a first-class Character — the collectible artifact.
 * 1080×1350 PNG (see {@link renderShareCard}).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const character = await getCharacter(id).catch(() => null)
  if (!character) {
    return new Response('Not found', { status: 404 })
  }

  const stats: ShareCardStat[] = [
    { value: `${character.storyCount}`, label: character.storyCount === 1 ? 'story' : 'stories' },
  ]
  if (character.worldIds.length > 1) {
    stats.push({ value: `${character.worldIds.length}`, label: 'worlds' })
  }

  return renderShareCard({
    kind: 'character',
    eyebrow: character.tagline || 'A character',
    title: character.name,
    subtitle: character.description || appearanceSummary(character),
    imageUrl: character.portraitUrl,
    stats,
  })
}
