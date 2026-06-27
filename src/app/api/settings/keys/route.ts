import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { getUserApiKey, saveUserApiKey, deleteUserApiKey } from '@/lib/firestore-helpers'
import { encrypt } from '@/lib/encrypt'

const KeySchema = z.object({
  apiKey: z.string().transform((s) => s.trim()).pipe(z.string().min(10, 'Invalid API key')),
})

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  try {
    return (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return null
  }
}

/** Returns whether the user has a key stored (never returns the key itself). */
export async function GET(req: NextRequest) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const encrypted = await getUserApiKey(uid)
  return NextResponse.json({ hasKey: !!encrypted })
}

/** Store an encrypted API key. Body: { apiKey: string } */
export async function POST(req: NextRequest) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseJson(req, KeySchema)
  if (!parsed.ok) return parsed.response

  await saveUserApiKey(uid, encrypt(parsed.data.apiKey))
  return NextResponse.json({ ok: true })
}

/** Delete the stored API key. */
export async function DELETE(req: NextRequest) {
  const uid = await resolveUser(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await deleteUserApiKey(uid)
  return NextResponse.json({ ok: true })
}

