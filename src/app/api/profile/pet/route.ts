import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getUserAchievements } from '@/lib/firestore-helpers'
import { stageFor, moodFor, quipFor, daySeed, PET_SPECIES, type PetSpecies } from '@/lib/pet'

async function resolveUser(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    return (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return null
  }
}

function normalizeSpecies(value: unknown): PetSpecies {
  return PET_SPECIES.some((s) => s.id === value) ? (value as PetSpecies) : 'bird'
}

/** The reader's Reader Pal state — species, level, mood, and a canned flavor line. Rule-based, not AI. */
export async function GET(req: NextRequest) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [settingsDoc, achievements] = await Promise.all([
    adminDb.collection('userSettings').doc(uid).get(),
    getUserAchievements(uid),
  ])
  const settings = settingsDoc.data()
  const name = (settings?.petName as string | undefined) ?? 'Inkling'
  const species = normalizeSpecies(settings?.petSpecies)
  const stage = stageFor(species, achievements.earned.length)
  const mood = moodFor(achievements.updatedAt)
  const quip = quipFor(mood, daySeed())

  return NextResponse.json({
    name,
    species,
    stage,
    mood,
    quip,
    achievementsEarned: achievements.earned.length,
  })
}

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(24).optional(),
  species: z.enum(['bird', 'dragon', 'sprout']).optional(),
})

/** Rename and/or reskin the reader's pal — the only things about it they directly control. */
export async function POST(req: NextRequest) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, UpdateSchema)
  if (!parsed.ok) return parsed.response
  const { name, species } = parsed.data
  if (name === undefined && species === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await adminDb.collection('userSettings').doc(uid).set(
    { ...(name !== undefined ? { petName: name } : {}), ...(species !== undefined ? { petSpecies: species } : {}) },
    { merge: true },
  )
  return NextResponse.json({ ok: true })
}
