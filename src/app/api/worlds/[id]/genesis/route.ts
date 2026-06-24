import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAuthContext } from '@/lib/auth'
import { getWorld, setWorldGenesis } from '@/lib/firestore-helpers'
import { buildGenesisSkeleton } from '@/lib/engine/world-genesis'
import { SeededRNG } from '@/lib/engine/seed-rng'
import { elaborateWorldBible } from '@/lib/ai'

/** Backfill: generate a genesis bible for an existing world (author or admin). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const world = await getWorld(id).catch(() => null)
  if (!world) return NextResponse.json({ error: 'World not found' }, { status: 404 })
  if (world.authorId !== auth.uid && !auth.isAdmin) {
    return NextResponse.json({ error: 'Only the world’s creator can generate its canon.' }, { status: 403 })
  }
  if (world.genesis) return NextResponse.json({ ok: true, already: true })

  const seed = world.seed ?? SeededRNG.hashString(world.name)
  const skeleton = buildGenesisSkeleton(seed, world.tone)
  const bible = await elaborateWorldBible(
    skeleton,
    { name: world.name, lore: world.lore, rules: world.rules, tone: world.tone },
    auth.uid,
  )
  await setWorldGenesis(id, bible)
  revalidateTag(`world-${id}`, 'max')
  return NextResponse.json({ ok: true })
}
