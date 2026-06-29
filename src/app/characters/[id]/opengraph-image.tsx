import { getCharacter } from '@/lib/firestore-helpers'
import { appearanceSummary } from '@/lib/characters'
import { renderOgImage, ogSize, ogContentType } from '@/lib/og'

export const alt = 'Character on Chronicle'
export const size = ogSize
export const contentType = ogContentType

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await getCharacter(id).catch(() => null)

  return renderOgImage({
    eyebrow: c?.tagline ?? 'Character',
    title: c?.name ?? 'A character on Chronicle',
    subtitle: c ? c.description || appearanceSummary(c) : undefined,
  })
}
