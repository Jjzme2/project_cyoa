import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { createWorld, getWorld, getWorldsByAuthor, checkAndAwardAchievements, setWorldGenesis } from '@/lib/firestore-helpers'
import { analytics } from '@/lib/telemetry'
import { buildGenesisSkeleton } from '@/lib/engine/world-genesis'
import { SeededRNG } from '@/lib/engine/seed-rng'
import { toMultiverseId } from '@/lib/multiverse'
import { elaborateWorldBible } from '@/lib/ai'
import { CONTENT_RATINGS, DEFAULT_CONTENT_RATING } from '@/types'
import type { WorldTheme } from '@/types'

const CreateWorldSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  lore: z.string().min(1),
  rules: z.string().min(1),
  tone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Invalid/absent ratings fall back to the default, as before.
  rating: z.enum(CONTENT_RATINGS).catch(DEFAULT_CONTENT_RATING),
  seed: z.union([z.number(), z.string()]).nullish(),
  theme: z.custom<WorldTheme>().optional(),
  // Optional multiverse this world joins; the pool key is derived server-side.
  multiverseName: z.string().optional(),
  // Optional explicit links to specific worlds; names are resolved server-side.
  links: z
    .array(z.object({ worldId: z.string().min(1), nexus: z.string().optional() }))
    .optional(),
  storySettings: z
    .object({
      mandate: z.string().optional(),
      proseStyles: z.array(z.string()).optional(),
      motifs: z.array(z.string()).optional(),
      styleOptions: z
        .array(z.object({ label: z.string(), choices: z.array(z.string()) }))
        .optional(),
    })
    .optional(),
})

type StyleOptionInput = { label: string; choices: string[] }
type StorySettingsInput = {
  mandate?: string
  proseStyles?: string[]
  motifs?: string[]
  styleOptions?: StyleOptionInput[]
}

/** Trim + bound the world story settings; drop it entirely if nothing is set. */
function sanitizeStorySettings(s: StorySettingsInput | undefined): StorySettingsInput | null {
  if (!s) return null
  const mandate = s.mandate?.trim().slice(0, 300) || undefined
  const clean = (arr?: string[]) =>
    (arr ?? []).map((x) => x.trim().slice(0, 120)).filter(Boolean).slice(0, 8)
  const proseStyles = clean(s.proseStyles)
  const motifs = clean(s.motifs)
  const styleOptions = (s.styleOptions ?? [])
    .map((o) => ({ label: (o.label ?? '').trim().slice(0, 60), choices: clean(o.choices) }))
    .filter((o) => o.label && o.choices.length > 0)
    .slice(0, 8)
  const out: StorySettingsInput = {
    ...(mandate ? { mandate } : {}),
    ...(proseStyles.length ? { proseStyles } : {}),
    ...(motifs.length ? { motifs } : {}),
    ...(styleOptions.length ? { styleOptions } : {}),
  }
  return Object.keys(out).length > 0 ? out : null
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const worlds = await getWorldsByAuthor(uid)
  return NextResponse.json({ worlds })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  let displayName: string | null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
    displayName = decoded.name ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const parsed = await parseJson(req, CreateWorldSchema)
  if (!parsed.ok) return parsed.response
  const { name, description, lore, rules, tone, tags, rating: safeRating, seed, theme } = parsed.data
  const storySettings = sanitizeStorySettings(parsed.data.storySettings)

  // Resolve an opt-in multiverse: a GLOBAL collective keyed by the normalized
  // name, so any creator who names their world into the same multiverse joins the
  // same shared pool. Opting in is the explicit, drawn connection; echoes are
  // rating-gated when they're read.
  const multiverseName = parsed.data.multiverseName?.trim().slice(0, 60) || ''
  const multiverseId = multiverseName ? toMultiverseId(multiverseName) : null
  const multiverse = multiverseId ? { id: multiverseId, name: multiverseName } : null

  // Resolve explicit links: validate each target exists and take its REAL name
  // server-side (never a client-supplied label), deduped, capped.
  const linkInputs = (parsed.data.links ?? []).slice(0, 8)
  const seenLinks = new Set<string>()
  const resolvedLinks: { worldId: string; worldName: string; nexus?: string }[] = []
  for (const l of linkInputs) {
    if (seenLinks.has(l.worldId)) continue
    seenLinks.add(l.worldId)
    const target = await getWorld(l.worldId).catch(() => null)
    if (!target) continue
    const nexus = l.nexus?.trim().slice(0, 120)
    resolvedLinks.push({ worldId: l.worldId, worldName: target.name, ...(nexus ? { nexus } : {}) })
    if (resolvedLinks.length >= 5) break
  }
  const links = resolvedLinks.length ? resolvedLinks : null

  const effectiveTone = tone ?? 'Epic Fantasy'
  // Every world gets a stable seed, so its genesis + simulation are reproducible.
  const effectiveSeed = seed !== undefined && seed !== null ? Number(seed) : SeededRNG.hashString(name)

  const id = await createWorld({
    name,
    description,
    lore,
    rules,
    tone: effectiveTone,
    authorId: uid,
    authorName: displayName ?? 'Anonymous',
    tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
    rating: safeRating,
    ratingOverriddenBy: null,
    seed: effectiveSeed,
    ...(theme ? { theme } : {}),
    ...(storySettings ? { storySettings } : {}),
    ...(multiverse ? { multiverse } : {}),
    ...(links ? { links } : {}),
  })

  revalidateTag('worlds', 'max')

  after(async () => {
    await checkAndAwardAchievements(uid, 'world_created').catch(() => {})
    await analytics.track('world.created', { uid, props: { worldId: id, rating: safeRating } })
    // Procedural world genesis: a seeded, cross-referenced canon skeleton,
    // elaborated by one LLM call, persisted as the world's bible.
    try {
      const skeleton = buildGenesisSkeleton(effectiveSeed, effectiveTone)
      const bible = await elaborateWorldBible(skeleton, { name, lore, rules, tone: effectiveTone }, uid)
      await setWorldGenesis(id, bible)
      revalidateTag(`world-${id}`, 'max')
    } catch (e) {
      console.error('[world genesis] failed:', e)
    }
  })

  return NextResponse.json({ id }, { status: 201 })
}
