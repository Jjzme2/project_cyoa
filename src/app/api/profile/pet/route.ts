import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { getUserAchievements } from '@/lib/firestore-helpers'
import { isSpeciesUnlocked } from '@/lib/pet'

async function resolveUser(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    return (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return null
  }
}

// The reader's Reader Pal state is served by the consolidated GET
// /api/profile/state; this route keeps only the rename/reskin mutation.

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(24).optional(),
  species: z.enum(['bird', 'dragon', 'sprout', 'cat', 'wisp', 'leviathan']).optional(),
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

  // Gated species require their achievement — enforced server-side, same
  // philosophy as equipping an avatar frame.
  if (species !== undefined) {
    const achievements = await getUserAchievements(uid)
    if (!isSpeciesUnlocked(species, achievements.earned)) {
      return NextResponse.json({ error: 'That companion hasn’t been unlocked yet.' }, { status: 403 })
    }
  }

  await adminDb.collection('userSettings').doc(uid).set(
    { ...(name !== undefined ? { petName: name } : {}), ...(species !== undefined ? { petSpecies: species } : {}) },
    { merge: true },
  )
  return NextResponse.json({ ok: true })
}
