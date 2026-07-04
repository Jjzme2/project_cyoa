import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJson } from '@/lib/api-validation'
import { adminAuth } from '@/lib/firebase-admin'
import { setReadingShelved } from '@/lib/firestore-helpers'

const ShelveSchema = z.object({ shelved: z.boolean() })

/** Put a book back on the shelf (or take it off) — hides/restores it in Continue Reading without touching progress. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> },
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uid: string
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { storyId } = await params
  const parsed = await parseJson(req, ShelveSchema)
  if (!parsed.ok) return parsed.response

  await setReadingShelved(uid, storyId, parsed.data.shelved)
  return NextResponse.json({ ok: true })
}
