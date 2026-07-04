import { NextRequest, NextResponse } from 'next/server'
import { listCharacters } from '@/lib/firestore-helpers'

/** Public, read-only character directory listing — powers pickers like guest-star selection. */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 100)
  const characters = await listCharacters(Math.min(limit, 200))
  return NextResponse.json({
    characters: characters.map((c) => ({ id: c.id, name: c.name, tagline: c.tagline })),
  })
}
