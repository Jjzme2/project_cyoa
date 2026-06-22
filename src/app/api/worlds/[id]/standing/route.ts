import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getWorldStanding } from '@/lib/firestore-helpers'

/** The signed-in reader's personal standing in this world (for "You" mode). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ standing: 0 })
  const standing = await getWorldStanding(auth.uid, id)
  return NextResponse.json({ standing })
}
