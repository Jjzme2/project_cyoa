import { NextResponse } from 'next/server'
import { getPublicMultiverses } from '@/lib/firestore-helpers'

// Public: the multiverses visible across public worlds, so any creator can
// discover and join an existing collective by its exact name.
export async function GET() {
  const multiverses = await getPublicMultiverses().catch(() => [])
  return NextResponse.json({ multiverses })
}
