import { renderShareCard } from '@/lib/share-card'
import { ACHIEVEMENT_DEFS } from '@/types'

/**
 * Portrait Share Card for an earned achievement — couples the viral share
 * primitive to an in-fiction accomplishment. Renders from the public
 * definition, so no auth/personal data is involved.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const def = ACHIEVEMENT_DEFS.find((d) => d.id === id)
  if (!def) return new Response('Not found', { status: 404 })

  return renderShareCard({
    kind: 'ending',
    eyebrow: 'Achievement unlocked',
    title: `${def.icon} ${def.name}`,
    subtitle: def.description,
    accent: '#f5d896',
  })
}
