import { getWorld } from '@/lib/firestore-helpers'
import { renderOgImage, ogSize, ogContentType } from '@/lib/og'

export const alt = 'World on Chronicle'
export const size = ogSize
export const contentType = ogContentType

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const world = await getWorld(id).catch(() => null)

  return renderOgImage({
    eyebrow: world?.tone ?? 'World',
    title: world?.name ?? 'A world on Chronicle',
    subtitle: world?.description,
  })
}
