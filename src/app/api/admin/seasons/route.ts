import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { getAuthContext } from '@/lib/auth'
import { listSeasons, upsertSeason } from '@/lib/firestore-helpers'
import { insights } from '@/lib/telemetry'

const SeasonSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1, 'Name is required').max(80),
    tagline: z.string().trim().min(1, 'Tagline is required').max(140),
    description: z.string().trim().max(2000).default(''),
    prompt: z.string().trim().max(2000).optional(),
    startsAt: z.string().datetime({ message: 'startsAt must be an ISO datetime' }),
    endsAt: z.string().datetime({ message: 'endsAt must be an ISO datetime' }),
    accent: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'accent must be a #rrggbb hex')
      .optional(),
    published: z.boolean().default(false),
    recurrence: z.enum(['none', 'monthly', 'yearly']).optional(),
    multiverseId: z.string().trim().min(1).nullable().optional(),
    multiverseName: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => Date.parse(d.endsAt) > Date.parse(d.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })

/** Admin-only: list all seasons (drafts included) for the management screen. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const seasons = await listSeasons()
  return NextResponse.json({ seasons })
}

/** Admin-only: create a season (no id) or update one (id present). */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseJson(req, SeasonSchema)
  if (!parsed.ok) return parsed.response
  const { id, ...input } = parsed.data

  const savedId = await upsertSeason(input, auth.uid, id)
  await insights.track(id ? 'season.updated' : 'season.created', {
    uid: auth.uid,
    props: { seasonId: savedId, name: input.name, published: input.published },
  })

  return NextResponse.json({ ok: true, id: savedId })
}
