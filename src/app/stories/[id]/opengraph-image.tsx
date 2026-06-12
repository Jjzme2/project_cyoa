import { getStory } from '@/lib/firestore-helpers'
import { renderOgImage, ogSize, ogContentType } from '@/lib/og'

export const alt = 'Story on Chronicle'
export const size = ogSize
export const contentType = ogContentType

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = await getStory(id).catch(() => null)

  return renderOgImage({
    eyebrow: story?.worldName ?? 'Chronicle',
    title: story?.title ?? 'A story on Chronicle',
    subtitle: story?.description || (story ? `by ${story.authorName}` : undefined),
  })
}
