import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { adoptOrSwitchPal } from '@/lib/pal-adoption'

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
// /api/profile/state; this route keeps the rename mutation and the
// switch/adopt flow (see lib/pal-adoption.ts — a money path).

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(24).optional(),
  species: z.enum(['bird', 'dragon', 'sprout', 'cat', 'wisp', 'leviathan']).optional(),
})

/** Rename the pal (free), switch to an owned pal (free), or adopt a new one (credits). */
export async function POST(req: NextRequest) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, UpdateSchema)
  if (!parsed.ok) return parsed.response
  const { name, species } = parsed.data
  if (name === undefined && species === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  let adopted = false
  if (species !== undefined) {
    const result = await adoptOrSwitchPal(uid, species)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    adopted = result.adopted
  }

  if (name !== undefined) {
    await adminDb.collection('userSettings').doc(uid).set({ petName: name }, { merge: true })
  }

  return NextResponse.json({ ok: true, adopted })
}
