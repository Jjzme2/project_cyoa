import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getWorldReputation } from '@/lib/firestore-helpers'

/** The signed-in reader's personal standing + trend in this world (for "You" mode). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ standing: 0, trend: 'steady' })
  const rep = await getWorldReputation(auth.uid, id)
  return NextResponse.json(rep)
}
